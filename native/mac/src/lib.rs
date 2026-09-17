#![cfg(target_os = "macos")]
//! Native macOS integrations for magibar-launcher: window control, the
//! pasteboard change counter, and Vision text recognition.
//!
//! Window control replaces the previous `osascript`/System Events shell-outs —
//! every call there forks a whole process and JIT-compiles an AppleScript, which
//! is why a tight timeout could (and did) spuriously fail under ordinary system
//! load. It talks directly to the same two frameworks osascript was driving
//! indirectly: CoreGraphics' window list (to find the frontmost app, no
//! permission needed) and the Accessibility API (`AXUIElement`) to
//! read/move/fullscreen its focused window (requires the same Accessibility
//! consent the AppleScript path needed). Both are plain C APIs —
//! `CGWindowListCopyWindowInfo` reports on-screen windows front-to-back by
//! z-order, which is enough to find "the frontmost real app window" without
//! `NSWorkspace`.
//!
//! The other two exports do need Objective-C, at two different levels of
//! ceremony. `pasteboard_change_count` is one scalar property read, done with a
//! raw `objc_msgSend` rather than pulling in a bridging crate for it.
//! `recognize_png` is a whole framework conversation — by-value `CGRect`
//! returns, an `NSRange` argument, error out-parameters — so it uses the `objc2`
//! bindings, where those signatures are checked at compile time instead of being
//! asserted by hand.

use core_foundation_sys::array::{CFArrayGetCount, CFArrayGetValueAtIndex, CFArrayRef};
use core_foundation_sys::base::{kCFAllocatorDefault, CFRelease, CFTypeRef};
use core_foundation_sys::dictionary::{CFDictionaryGetValue, CFDictionaryRef};
use core_foundation_sys::number::{
  kCFBooleanFalse, kCFBooleanTrue, kCFNumberSInt32Type, kCFNumberSInt64Type, CFBooleanGetValue,
  CFBooleanRef, CFNumberGetValue, CFNumberRef,
};
use core_foundation_sys::string::{kCFStringEncodingUTF8, CFStringCreateWithCString, CFStringRef};
use napi_derive::napi;
use std::ffi::{c_void, CString};

// -- Accessibility (AXUIElement) — not covered by `core-foundation-sys`, so
// declared here directly against `ApplicationServices` (linked in `build.rs`). --

type AXUIElementRef = CFTypeRef;
type AXValueRef = CFTypeRef;
type AXError = i32;

#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
  fn AXUIElementCreateApplication(pid: i32) -> AXUIElementRef;
  fn AXUIElementCopyAttributeValue(
    element: AXUIElementRef,
    attribute: CFStringRef,
    value: *mut CFTypeRef,
  ) -> AXError;
  fn AXUIElementSetAttributeValue(
    element: AXUIElementRef,
    attribute: CFStringRef,
    value: CFTypeRef,
  ) -> AXError;
  fn AXValueGetValue(value: AXValueRef, the_type: u32, value_ptr: *mut c_void) -> u8;
  fn AXValueCreate(the_type: u32, value_ptr: *const c_void) -> AXValueRef;
}

const K_AX_ERROR_SUCCESS: AXError = 0;
const K_AX_VALUE_TYPE_CG_POINT: u32 = 1;
const K_AX_VALUE_TYPE_CG_SIZE: u32 = 2;

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
  fn CGWindowListCopyWindowInfo(option: u32, relative_to_window: u32) -> CFArrayRef;
}

const K_CG_WINDOW_LIST_OPTION_ON_SCREEN_ONLY: u32 = 1 << 0;
const K_CG_WINDOW_LIST_EXCLUDE_DESKTOP_ELEMENTS: u32 = 1 << 4;
const K_CG_NULL_WINDOW_ID: u32 = 0;

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct CgPoint {
  x: f64,
  y: f64,
}

#[repr(C)]
#[derive(Copy, Clone, Default)]
struct CgSize {
  width: f64,
  height: f64,
}

/// Builds a CFString from a Rust `&str`, content-compared (not pointer-identity)
/// against dictionary/attribute keys — this is how `CFDictionaryGetValue` and the
/// AX attribute-name arguments below are meant to be used, so there's no need to
/// link the framework's exported `kCGWindowOwnerPID`-style constant symbols.
unsafe fn cfstring(s: &str) -> CFStringRef {
  let c = CString::new(s).unwrap();
  unsafe { CFStringCreateWithCString(kCFAllocatorDefault, c.as_ptr(), kCFStringEncodingUTF8) }
}

/// Reads a CFNumber as `i64` regardless of whether it's stored as 32- or 64-bit —
/// `CFNumberGetValue` converts for you as long as the requested width fits.
unsafe fn cfnumber_i64(number: CFNumberRef) -> Option<i64> {
  let mut out: i64 = 0;
  let ok = unsafe {
    CFNumberGetValue(number, kCFNumberSInt64Type, &mut out as *mut i64 as *mut c_void)
  };
  if ok {
    return Some(out);
  }
  // Some SDKs store small integers as SInt32; fall back rather than fail outright.
  let mut out32: i32 = 0;
  let ok32 = unsafe {
    CFNumberGetValue(number, kCFNumberSInt32Type, &mut out32 as *mut i32 as *mut c_void)
  };
  if ok32 {
    Some(out32 as i64)
  } else {
    None
  }
}

/// The pid of the frontmost real application window, or `0` if none is found
/// (e.g. every window is a desktop element, or the list is empty). `exclude` is
/// our own pid — the launcher itself can briefly be the frontmost window right as
/// it's shown/hidden, and capturing it would mean later commands snap our own
/// window instead of whatever the user was actually working in.
///
/// `CGWindowListCopyWindowInfo` needs no special permission and reports windows
/// front-to-back by on-screen stacking order, so the first entry whose layer is 0
/// (an ordinary app window — the Dock, menu bar, etc. use nonzero layers) and
/// whose owner isn't `exclude` is exactly "what the user was looking at."
#[napi]
pub fn frontmost_pid(exclude: i32) -> i32 {
  unsafe {
    let list = CGWindowListCopyWindowInfo(
      K_CG_WINDOW_LIST_OPTION_ON_SCREEN_ONLY | K_CG_WINDOW_LIST_EXCLUDE_DESKTOP_ELEMENTS,
      K_CG_NULL_WINDOW_ID,
    );
    if list.is_null() {
      return 0;
    }

    let layer_key = cfstring("kCGWindowLayer");
    let pid_key = cfstring("kCGWindowOwnerPID");

    let count = CFArrayGetCount(list);
    let mut found = 0i32;
    for i in 0..count {
      let entry = CFArrayGetValueAtIndex(list, i) as CFDictionaryRef;
      if entry.is_null() {
        continue;
      }

      let layer_value = CFDictionaryGetValue(entry, layer_key as *const c_void) as CFNumberRef;
      let layer = if layer_value.is_null() {
        None
      } else {
        cfnumber_i64(layer_value)
      };
      if layer != Some(0) {
        continue;
      }

      let pid_value = CFDictionaryGetValue(entry, pid_key as *const c_void) as CFNumberRef;
      if pid_value.is_null() {
        continue;
      }
      let Some(pid) = cfnumber_i64(pid_value) else {
        continue;
      };
      let pid = pid as i32;
      if pid != 0 && pid != exclude {
        found = pid;
        break;
      }
    }

    CFRelease(layer_key as CFTypeRef);
    CFRelease(pid_key as CFTypeRef);
    CFRelease(list as CFTypeRef);
    found
  }
}

/// The application's focused window, or `null` (`AXError`) if it has none, the
/// pid is invalid, or Accessibility access hasn't been granted. Caller must
/// `CFRelease` the returned element.
unsafe fn focused_window(pid: i32) -> Option<AXUIElementRef> {
  unsafe {
    let app = AXUIElementCreateApplication(pid);
    if app.is_null() {
      return None;
    }
    let attr = cfstring("AXFocusedWindow");
    let mut window: CFTypeRef = std::ptr::null();
    let err = AXUIElementCopyAttributeValue(app, attr, &mut window as *mut CFTypeRef);
    CFRelease(attr as CFTypeRef);
    CFRelease(app);
    if err == K_AX_ERROR_SUCCESS && !window.is_null() {
      Some(window)
    } else {
      None
    }
  }
}

#[napi(object)]
pub struct MacRect {
  pub x: f64,
  pub y: f64,
  pub width: f64,
  pub height: f64,
}

/// The focused window's current position and size, or `null` if unavailable
/// (no focused window, invalid pid, or Accessibility access not granted).
#[napi]
pub fn get_window_rect(pid: i32) -> Option<MacRect> {
  unsafe {
    let window = focused_window(pid)?;

    let pos_attr = cfstring("AXPosition");
    let size_attr = cfstring("AXSize");

    let mut pos_value: CFTypeRef = std::ptr::null();
    let pos_err = AXUIElementCopyAttributeValue(window, pos_attr, &mut pos_value as *mut CFTypeRef);
    let mut size_value: CFTypeRef = std::ptr::null();
    let size_err =
      AXUIElementCopyAttributeValue(window, size_attr, &mut size_value as *mut CFTypeRef);
    CFRelease(pos_attr as CFTypeRef);
    CFRelease(size_attr as CFTypeRef);

    let result = if pos_err == K_AX_ERROR_SUCCESS
      && size_err == K_AX_ERROR_SUCCESS
      && !pos_value.is_null()
      && !size_value.is_null()
    {
      let mut point = CgPoint::default();
      let mut size = CgSize::default();
      let got_point = AXValueGetValue(
        pos_value,
        K_AX_VALUE_TYPE_CG_POINT,
        &mut point as *mut CgPoint as *mut c_void,
      );
      let got_size = AXValueGetValue(
        size_value,
        K_AX_VALUE_TYPE_CG_SIZE,
        &mut size as *mut CgSize as *mut c_void,
      );
      if got_point != 0 && got_size != 0 {
        Some(MacRect {
          x: point.x,
          y: point.y,
          width: size.width,
          height: size.height,
        })
      } else {
        None
      }
    } else {
      None
    };

    if !pos_value.is_null() {
      CFRelease(pos_value);
    }
    if !size_value.is_null() {
      CFRelease(size_value);
    }
    CFRelease(window);
    result
  }
}

/// Moves and resizes the focused window to `rect`. Sets size, then position, then
/// size again — some apps clamp or reflow their frame when it lands near a screen
/// edge, and re-asserting the size after the move is what makes the final result
/// stick (same workaround the AppleScript version used). Returns whether both
/// attributes were written successfully.
#[napi]
pub fn apply_window_rect(pid: i32, rect: MacRect) -> bool {
  unsafe {
    let Some(window) = focused_window(pid) else {
      return false;
    };

    let pos_attr = cfstring("AXPosition");
    let size_attr = cfstring("AXSize");

    let point = CgPoint { x: rect.x, y: rect.y };
    let size = CgSize {
      width: rect.width,
      height: rect.height,
    };

    let size_value = AXValueCreate(K_AX_VALUE_TYPE_CG_SIZE, &size as *const CgSize as *const c_void);
    let pos_value = AXValueCreate(K_AX_VALUE_TYPE_CG_POINT, &point as *const CgPoint as *const c_void);

    let mut ok = true;
    if !size_value.is_null() {
      ok &= AXUIElementSetAttributeValue(window, size_attr, size_value) == K_AX_ERROR_SUCCESS;
    } else {
      ok = false;
    }
    if !pos_value.is_null() {
      ok &= AXUIElementSetAttributeValue(window, pos_attr, pos_value) == K_AX_ERROR_SUCCESS;
    } else {
      ok = false;
    }
    if !size_value.is_null() {
      ok &= AXUIElementSetAttributeValue(window, size_attr, size_value) == K_AX_ERROR_SUCCESS;
    }

    if !size_value.is_null() {
      CFRelease(size_value);
    }
    if !pos_value.is_null() {
      CFRelease(pos_value);
    }
    CFRelease(pos_attr as CFTypeRef);
    CFRelease(size_attr as CFTypeRef);
    CFRelease(window);
    ok
  }
}

/// Whether the focused window is currently in native macOS fullscreen (its own
/// Space). `false` for anything that can't be determined (no focused window,
/// permission not granted, or the window doesn't support this attribute at all —
/// `AXFullScreen` isn't part of the standard Accessibility attribute set, so a
/// missing-attribute error here just means "this app doesn't offer fullscreen,"
/// not a real failure).
#[napi]
pub fn is_fullscreen(pid: i32) -> bool {
  unsafe {
    let Some(window) = focused_window(pid) else {
      return false;
    };
    let attr = cfstring("AXFullScreen");
    let mut value: CFTypeRef = std::ptr::null();
    let err = AXUIElementCopyAttributeValue(window, attr, &mut value as *mut CFTypeRef);
    CFRelease(attr as CFTypeRef);

    let result = if err == K_AX_ERROR_SUCCESS && !value.is_null() {
      CFBooleanGetValue(value as CFBooleanRef)
    } else {
      false
    };
    if !value.is_null() {
      CFRelease(value);
    }
    CFRelease(window);
    result
  }
}

// -- NSPasteboard (AppKit) — Objective-C only, no Core Foundation or plain-C
// equivalent exists for this, so unlike everything above this talks to the
// Objective-C runtime directly (`objc_msgSend`) rather than a framework's C
// API. Kept to this one scalar property read rather than pulling in a
// bridging crate for it. --

#[link(name = "objc", kind = "dylib")]
unsafe extern "C" {
  fn objc_getClass(name: *const std::ffi::c_char) -> *mut c_void;
  fn sel_registerName(name: *const std::ffi::c_char) -> *mut c_void;
  fn objc_msgSend(receiver: *mut c_void, sel: *mut c_void) -> *mut c_void;
}

// No AppKit C symbols are called directly — this block exists purely to force
// the framework to be linked (and so loaded into the process), which is what
// actually registers `NSPasteboard` with the Objective-C runtime.
// `objc_getClass` on an unlinked framework's class silently returns nil, and
// a message sent to nil silently returns 0 — the bug this caught: without
// this, `pasteboard_change_count()` compiled and ran fine, just always
// returned 0.
#[link(name = "AppKit", kind = "framework")]
unsafe extern "C" {}

/// `NSPasteboard.generalPasteboard.changeCount` — a counter AppKit increments
/// every time the general pasteboard's *content* changes (a copy, a cut, or
/// any programmatic write), and never otherwise. macOS has no pasteboard
/// "changed" notification/event at all — every clipboard-history app,
/// Raycast included, is built around polling *something*; the point of this
/// export is to make that something cheap. Reading it costs nothing (no IPC,
/// no permission prompt, no clipboard format negotiation) — a poller can
/// check this very frequently and only pay for an actual Electron
/// `clipboard.read()` call on the rare tick where it's moved.
///
/// `generalPasteboard` is a process-wide singleton the caller doesn't own
/// (the selector isn't `alloc`/`new`/`copy`-prefixed), so it's never
/// released — same manual-reference-counting convention every other
/// Objective-C call in this codebase already assumes, just without a
/// bridging crate to enforce it for us here.
#[napi]
pub fn pasteboard_change_count() -> i64 {
  unsafe {
    let cls = objc_getClass(c"NSPasteboard".as_ptr());
    let general_sel = sel_registerName(c"generalPasteboard".as_ptr());
    let pasteboard = objc_msgSend(cls, general_sel);
    let change_count_sel = sel_registerName(c"changeCount".as_ptr());
    objc_msgSend(pasteboard, change_count_sel) as i64
  }
}

/// Toggles native macOS fullscreen on the focused window — the same effect as
/// clicking-and-holding the green traffic-light button and choosing "Enter/Exit
/// Full Screen." Not every window supports this; returns whether the write
/// succeeded.
#[napi]
pub fn toggle_fullscreen(pid: i32) -> bool {
  unsafe {
    let Some(window) = focused_window(pid) else {
      return false;
    };
    let current = is_fullscreen(pid);
    let attr = cfstring("AXFullScreen");

    // Every CFBoolean is one of exactly two process-wide singletons.
    let value = if current {
      kCFBooleanFalse as CFTypeRef
    } else {
      kCFBooleanTrue as CFTypeRef
    };
    let err = AXUIElementSetAttributeValue(window, attr, value);
    CFRelease(attr as CFTypeRef);
    CFRelease(window);
    err == K_AX_ERROR_SUCCESS
  }
}

// ---------------------------------------------------------------------------
// Text recognition (Vision)
// ---------------------------------------------------------------------------

use napi::bindgen_prelude::{AsyncTask, Buffer, Env, Error, Result};
use napi::Task;
use objc2::rc::{autoreleasepool, Retained};
use objc2::{msg_send, AnyThread};
use objc2_core_foundation::CGRect;
use objc2_foundation::{NSArray, NSData, NSDictionary, NSError, NSRange, NSString};
use objc2_vision::{
  VNImageRequestHandler, VNRecognizeTextRequest, VNRectangleObservation, VNRequest,
  VNRequestTextRecognitionLevel
};

/// One recognized word, in source-image pixels, origin top-left.
#[napi(object)]
pub struct OcrWordBox {
  pub text: String,
  pub x: f64,
  pub y: f64,
  pub width: f64,
  pub height: f64
}

#[napi(object)]
pub struct OcrTextLine {
  pub text: String,
  /// Vision scores a whole recognized candidate (a line), not each word in it,
  /// so this is the line's score and the TS side copies it onto its words.
  pub confidence: Option<f64>,
  pub words: Vec<OcrWordBox>
}

#[napi(object)]
pub struct OcrPage {
  pub language: String,
  pub lines: Vec<OcrTextLine>
}

/// An image's dimensions, read straight out of the PNG header.
///
/// Vision reports boxes in *normalized* coordinates (0-1, origin bottom-left),
/// so converting them to pixels needs the image's size — and the caller always
/// hands us a PNG (`image.ts` re-encodes whatever it was given), whose IHDR
/// chunk is at a fixed offset. Cheaper and simpler than decoding the image a
/// second time just to ask how big it is.
fn png_size(png: &[u8]) -> Option<(f64, f64)> {
  const SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
  if png.len() < 24 || png[..8] != SIGNATURE || &png[12..16] != b"IHDR" {
    return None;
  }
  let width = u32::from_be_bytes(png[16..20].try_into().ok()?);
  let height = u32::from_be_bytes(png[20..24].try_into().ok()?);
  if width == 0 || height == 0 {
    return None;
  }
  Some((width as f64, height as f64))
}

/// The whitespace-separated words of `text`, each with its range in UTF-16
/// code units — the unit `NSString`, and so `boundingBoxForRange:`, counts in.
/// Counting Rust `char`s or bytes instead would put every box in the wrong
/// place the moment a line contains an emoji or a non-BMP character.
fn word_ranges(text: &str) -> Vec<(NSRange, String)> {
  let mut out = Vec::new();
  let mut offset = 0usize;
  let mut start: Option<usize> = None;
  let mut current = String::new();

  for character in text.chars() {
    if character.is_whitespace() {
      if let Some(from) = start.take() {
        out.push((
          NSRange {
            location: from,
            length: offset - from
          },
          std::mem::take(&mut current)
        ));
      }
    } else {
      if start.is_none() {
        start = Some(offset);
      }
      current.push(character);
    }
    offset += character.len_utf16();
  }

  if let Some(from) = start {
    out.push((
      NSRange {
        location: from,
        length: offset - from
      },
      current
    ));
  }
  out
}

/// Vision's normalized, bottom-left-origin rect as top-left-origin pixels —
/// the convention every other part of this feature uses.
fn to_pixels(rect: CGRect, text: String, width: f64, height: f64) -> OcrWordBox {
  OcrWordBox {
    text,
    x: rect.origin.x * width,
    y: (1.0 - rect.origin.y - rect.size.height) * height,
    width: rect.size.width * width,
    height: rect.size.height * height
  }
}

/// The BCP-47 tags Vision can recognize, best-first, as it reports them for
/// the accurate recognition level.
#[napi]
pub fn ocr_languages() -> Vec<String> {
  autoreleasepool(|pool| {
    let request = unsafe { VNRecognizeTextRequest::new() };
    request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
    let Ok(languages) = (unsafe { request.supportedRecognitionLanguagesAndReturnError() }) else {
      return Vec::new();
    };
    languages
      .iter()
      .map(|tag| tag.to_str(pool).to_owned())
      .collect()
  })
}

fn recognize(png: &[u8], language: Option<&str>) -> std::result::Result<OcrPage, String> {
  let (width, height) = png_size(png).ok_or("That image could not be read.")?;

  autoreleasepool(|pool| {
    let data = NSData::with_bytes(png);
    let handler = VNImageRequestHandler::initWithData_options(
      VNImageRequestHandler::alloc(),
      &data,
      &NSDictionary::new()
    );

    let request = unsafe { VNRecognizeTextRequest::new() };
    // Accurate over Fast: this runs on a still image the user chose, not a
    // video frame, so a few extra milliseconds for a materially better read is
    // the right trade.
    request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
    request.setUsesLanguageCorrection(true);
    let used = match language {
      Some(tag) => {
        let tags = NSArray::from_retained_slice(&[NSString::from_str(tag)]);
        unsafe { request.setRecognitionLanguages(&tags) };
        tag.to_owned()
      }
      None => unsafe { request.recognitionLanguages() }
        .firstObject()
        .map(|tag| tag.to_str(pool).to_owned())
        .unwrap_or_default()
    };

    let requests: Retained<NSArray<VNRequest>> =
      NSArray::from_retained_slice(&[Retained::into_super(request.clone())]);
    handler
      .performRequests_error(&requests)
      .map_err(|error| error.localizedDescription().to_str(pool).to_owned())?;

    let mut lines = Vec::new();
    for observation in request.results().into_iter().flatten() {
      let candidates = observation.topCandidates(1);
      let Some(candidate) = candidates.firstObject() else {
        continue;
      };
      let text = candidate.string().to_str(pool).to_owned();
      if text.trim().is_empty() {
        continue;
      }
      let confidence = candidate.confidence() as f64;

      let mut words = Vec::new();
      for (range, word) in word_ranges(&text) {
        // Not part of the generated bindings, so sent by selector. A failure
        // here (Vision can refuse a range it can't map back to the image)
        // falls back to the whole line's box rather than dropping the word.
        let boxed: Option<Retained<VNRectangleObservation>> = unsafe {
          msg_send![
            &*candidate,
            boundingBoxForRange: range,
            error: std::ptr::null_mut::<*mut NSError>(),
          ]
        };
        let rect = match &boxed {
          Some(rectangle) => unsafe { rectangle.boundingBox() },
          None => unsafe { observation.boundingBox() }
        };
        words.push(to_pixels(rect, word, width, height));
      }

      lines.push(OcrTextLine {
        text,
        confidence: Some(confidence),
        words
      });
    }

    Ok(OcrPage {
      language: used,
      lines
    })
  })
}

pub struct RecognizeTask {
  png: Vec<u8>,
  language: Option<String>
}

impl Task for RecognizeTask {
  type Output = OcrPage;
  type JsValue = OcrPage;

  fn compute(&mut self) -> Result<Self::Output> {
    recognize(&self.png, self.language.as_deref())
      .map_err(|error| Error::from_reason(format!("Vision text recognition failed: {error}")))
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

/// Recognizes the text in `png` with Vision's `VNRecognizeTextRequest` — the
/// same on-device recognizer behind Live Text. `language` is a tag from
/// `ocr_languages()`; omit it to use Vision's own default order.
///
/// Runs on the libuv threadpool rather than the JS thread: `performRequests:`
/// is synchronous and takes real time on a full-page screenshot, and doing it
/// inline would stall the launcher's UI for exactly as long. Vision is safe to
/// call off the main thread, and no Objective-C object crosses back — only the
/// plain Rust `OcrPage` built inside the autorelease pool.
#[napi(ts_return_type = "Promise<OcrPage>")]
pub fn recognize_png(png: Buffer, language: Option<String>) -> AsyncTask<RecognizeTask> {
  AsyncTask::new(RecognizeTask {
    png: png.to_vec(),
    language
  })
}
