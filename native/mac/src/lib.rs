#![cfg(target_os = "macos")]
//! Native macOS window control for benpocket-launcher.
//!
//! Replaces the previous `osascript`/System Events shell-outs — every call there
//! forks a whole process and JIT-compiles an AppleScript, which is why a tight
//! timeout could (and did) spuriously fail under ordinary system load. This talks
//! directly to the same two frameworks osascript was driving indirectly:
//! CoreGraphics' window list (to find the frontmost app, no permission needed)
//! and the Accessibility API (`AXUIElement`) to read/move/fullscreen its focused
//! window (requires the same Accessibility consent the AppleScript path needed).
//!
//! No Objective-C runtime is used at all — `CGWindowListCopyWindowInfo` is a
//! plain C API that reports on-screen windows front-to-back by z-order, which is
//! enough to find "the frontmost real app window" without `NSWorkspace`.

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
