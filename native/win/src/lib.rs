#![cfg(windows)]
//! Native Windows icon extraction for benpocket-launcher.
//!
//! Replaces a PowerShell script that shelled out to `powershell.exe` and JIT-compiled
//! an embedded C# helper via `Add-Type` on every app-list refresh. `Electron`'s
//! `app.getFileIcon()` (backed by Chromium's `SHGetFileInfo`) unreliably falls back to
//! the generic "unknown file" icon for some executables even though they have a proper
//! embedded icon resource; `ExtractIconEx` reads the resource directly and is reliable
//! where `SHGetFileInfo` is not. Packaged (MSIX/UWP) apps have no PE icon resource at
//! all, so their icon has to come from the shell via `IShellItemImageFactory`, and their
//! list comes from enumerating the virtual `shell:AppsFolder`.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use windows::core::{Interface, HSTRING};
use windows::Win32::Graphics::Gdi::{
  CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDIBits, SelectObject,
  BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ
};
use windows::Win32::Storage::EnhancedStorage::{PKEY_AppUserModel_ID, PKEY_ItemNameDisplay};
use windows::Win32::System::Com::{
  CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, IPersistFile,
  CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, STGM_READ
};
use windows::Win32::UI::Shell::{
  BHID_EnumItems, ExtractIconExW, IEnumShellItems, IShellItem, IShellItem2, IShellItemImageFactory,
  IShellLinkW, SHCreateItemFromParsingName, ShellLink, SIGDN_NORMALDISPLAY, SIIGBF_RESIZETOFIT,
  SLGP_RAWPATH
};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, DrawIconEx, DI_NORMAL, HICON};

/// COM must be initialized on whatever thread calls into these APIs. napi-rs runs
/// `#[napi]` functions on the JS thread by default, which is a single, stable OS
/// thread for the lifetime of the process, so initializing once per call (ignoring
/// "already initialized") and never uninitializing is fine here — this module never
/// runs off-thread.
struct ComGuard(bool);

impl ComGuard {
  fn new() -> Self {
    // S_FALSE ("already initialized on this thread") and RPC_E_CHANGED_MODE both mean
    // we must not pair this with CoUninitialize; only tear down on a clean S_OK init.
    let hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
    Self(hr.is_ok())
  }
}

impl Drop for ComGuard {
  fn drop(&mut self) {
    if self.0 {
      unsafe { CoUninitialize() };
    }
  }
}

/// Converts an HICON to PNG bytes by drawing it onto a top-down 32bpp DIB section and
/// reading the pixels back directly, which (unlike GDI+'s `Icon.ToBitmap()`) preserves
/// per-pixel alpha for modern 32-bit ARGB icons. Falls back to the icon's AND mask for
/// legacy icons that carry no real alpha channel (mask-only transparency).
fn hicon_to_png(hicon: HICON, width: i32, height: i32) -> Option<Vec<u8>> {
  unsafe {
    let hdc_screen = CreateCompatibleDC(None);
    if hdc_screen.is_invalid() {
      return None;
    }
    let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
    if hdc_mem.is_invalid() {
      let _ = DeleteDC(hdc_screen);
      return None;
    }

    let bmi = BITMAPINFO {
      bmiHeader: BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: width,
        biHeight: -height, // negative = top-down DIB, so row 0 is the top row
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB.0,
        ..Default::default()
      },
      ..Default::default()
    };

    let mut bits_ptr: *mut core::ffi::c_void = std::ptr::null_mut();
    let hbitmap = match CreateDIBSection(Some(hdc_screen), &bmi, DIB_RGB_COLORS, &mut bits_ptr, None, 0) {
      Ok(h) if !h.is_invalid() && !bits_ptr.is_null() => h,
      other => {
        eprintln!("[win-icons] CreateDIBSection failed: {other:?}");
        let _ = DeleteDC(hdc_mem);
        let _ = DeleteDC(hdc_screen);
        return None;
      }
    };

    let prev = SelectObject(hdc_mem, HGDIOBJ(hbitmap.0));
    // Icons can have transparent regions; make sure we start from a cleared (fully
    // transparent) buffer rather than whatever CreateDIBSection happened to allocate.
    std::ptr::write_bytes(bits_ptr as *mut u8, 0, (width as usize) * (height as usize) * 4);
    if let Err(e) = DrawIconEx(hdc_mem, 0, 0, hicon, width, height, 0, None, DI_NORMAL) {
      eprintln!("[win-icons] DrawIconEx failed: {e:?}");
    }

    let pixel_count = (width as usize) * (height as usize);
    let mut bgra = vec![0u8; pixel_count * 4];
    std::ptr::copy_nonoverlapping(bits_ptr as *const u8, bgra.as_mut_ptr(), bgra.len());

    let has_alpha = bgra.chunks_exact(4).any(|px| px[3] != 0);
    if !has_alpha {
      // Legacy icon with no real alpha channel: fall back to the icon's AND mask via
      // GetIconInfo so masked-out pixels are still transparent instead of opaque black.
      apply_and_mask_alpha(hicon, width, height, &mut bgra);
    }

    SelectObject(hdc_mem, prev);
    let _ = DeleteObject(HGDIOBJ(hbitmap.0));
    let _ = DeleteDC(hdc_mem);
    let _ = DeleteDC(hdc_screen);

    let mut rgba = bgra;
    for px in rgba.chunks_exact_mut(4) {
      px.swap(0, 2); // BGRA -> RGBA
    }

    let Some(image) = image::RgbaImage::from_raw(width as u32, height as u32, rgba) else {
      eprintln!("[win-icons] RgbaImage::from_raw failed (w={width} h={height})");
      return None;
    };
    let mut out = Vec::new();
    if let Err(e) = image.write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png) {
      eprintln!("[win-icons] PNG encode failed: {e:?}");
      return None;
    }
    Some(out)
  }
}

fn apply_and_mask_alpha(hicon: HICON, width: i32, height: i32, bgra: &mut [u8]) {
  use windows::Win32::UI::WindowsAndMessaging::{GetIconInfo, ICONINFO};

  unsafe {
    let mut info = ICONINFO::default();
    if GetIconInfo(hicon, &mut info).is_err() {
      return;
    }
    if !info.hbmColor.is_invalid() {
      let _ = DeleteObject(HGDIOBJ(info.hbmColor.0));
    }
    if info.hbmMask.is_invalid() {
      return;
    }

    // The AND mask is a 1bpp DIB; for icons with no separate XOR mask its height is
    // 2x the icon height (color rows followed by mask rows) — request just the mask.
    let hdc = CreateCompatibleDC(None);
    let stride = ((width + 31) / 32) * 4; // 1bpp rows are DWORD-aligned
    let mut mask_bits = vec![0u8; (stride as usize) * (height as usize)];
    let mut mask_bmi = BITMAPINFO {
      bmiHeader: BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: width,
        biHeight: -height,
        biPlanes: 1,
        biBitCount: 1,
        biCompression: BI_RGB.0,
        ..Default::default()
      },
      ..Default::default()
    };
    let got = GetDIBits(
      hdc,
      info.hbmMask,
      0,
      height as u32,
      Some(mask_bits.as_mut_ptr() as *mut core::ffi::c_void),
      &mut mask_bmi,
      DIB_RGB_COLORS
    );
    let _ = DeleteObject(HGDIOBJ(info.hbmMask.0));
    let _ = DeleteDC(hdc);
    if got == 0 {
      return;
    }

    for y in 0..height as usize {
      for x in 0..width as usize {
        let byte = mask_bits[y * stride as usize + x / 8];
        let bit_set = (byte >> (7 - (x % 8))) & 1 == 1; // 1 = transparent in an AND mask
        let idx = (y * width as usize + x) * 4;
        bgra[idx + 3] = if bit_set { 0 } else { 255 };
      }
    }
  }
}

/// Extracts the icon embedded in a PE file (.exe/.dll) at the given resource index and
/// returns it as PNG bytes, or `null` if the file has no icon at that index.
#[napi]
pub fn extract_icon_png(path: String, index: i32) -> Option<Buffer> {
  let _com = ComGuard::new();
  let wpath = HSTRING::from(&path);
  unsafe {
    let mut large: [HICON; 1] = [HICON::default()];
    let mut small: [HICON; 1] = [HICON::default()];
    let count = ExtractIconExW(&wpath, index, Some(large.as_mut_ptr()), Some(small.as_mut_ptr()), 1);
    if count == 0 {
      return None;
    }

    let (hicon, size) = if !large[0].is_invalid() {
      (large[0], 32)
    } else if !small[0].is_invalid() {
      (small[0], 16)
    } else {
      return None;
    };

    let png = hicon_to_png(hicon, size, size);
    if !large[0].is_invalid() {
      let _ = DestroyIcon(large[0]);
    }
    if !small[0].is_invalid() {
      let _ = DestroyIcon(small[0]);
    }
    png.map(Buffer::from)
  }
}

#[napi(object)]
pub struct ShortcutInfo {
  pub target_path: String,
  pub icon_path: String,
  pub icon_index: i32,
}

/// Reads a `.lnk` shortcut's target path and icon location, replacing the
/// `WScript.Shell` COM object previously driven from PowerShell.
#[napi]
pub fn resolve_shortcut(path: String) -> Option<ShortcutInfo> {
  let _com = ComGuard::new();
  unsafe {
    let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
    let persist_file: IPersistFile = link.cast().ok()?;
    let wpath = HSTRING::from(&path);
    persist_file.Load(&wpath, STGM_READ).ok()?;

    let mut target_buf = [0u16; 4096];
    link.GetPath(&mut target_buf, std::ptr::null_mut(), SLGP_RAWPATH.0 as u32).ok()?;
    let target_path = pwstr_to_string(&target_buf);

    let mut icon_buf = [0u16; 4096];
    let mut icon_index = 0i32;
    let icon_path = if link.GetIconLocation(&mut icon_buf, &mut icon_index).is_ok() {
      pwstr_to_string(&icon_buf)
    } else {
      String::new()
    };

    Some(ShortcutInfo { target_path, icon_path, icon_index })
  }
}

fn pwstr_to_string(buf: &[u16]) -> String {
  let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
  String::from_utf16_lossy(&buf[..len])
}

/// Renders the tile icon for a packaged (MSIX/UWP) app via the same
/// `IShellItemImageFactory` mechanism Explorer uses, addressed by its
/// AppUserModelID under the virtual `shell:AppsFolder`.
#[napi]
pub fn extract_packaged_icon_png(app_id: String, size: u32) -> Option<Buffer> {
  let _com = ComGuard::new();
  unsafe {
    let parsing_name = format!("shell:AppsFolder\\{app_id}");
    let wname = HSTRING::from(&parsing_name);
    let item: IShellItem = SHCreateItemFromParsingName(&wname, None).ok()?;
    let factory: IShellItemImageFactory = item.cast().ok()?;

    let sz = windows::Win32::Foundation::SIZE { cx: size as i32, cy: size as i32 };
    let hbitmap = factory.GetImage(sz, SIIGBF_RESIZETOFIT).ok()?;
    let png = hbitmap_to_png(hbitmap, size as i32, size as i32);
    let _ = DeleteObject(HGDIOBJ(hbitmap.0));
    png.map(Buffer::from)
  }
}

fn hbitmap_to_png(hbitmap: HBITMAP, width: i32, height: i32) -> Option<Vec<u8>> {
  unsafe {
    let hdc = CreateCompatibleDC(None);
    let mut bmi = BITMAPINFO {
      bmiHeader: BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: width,
        biHeight: -height,
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB.0,
        ..Default::default()
      },
      ..Default::default()
    };
    let mut bgra = vec![0u8; (width as usize) * (height as usize) * 4];
    let got = GetDIBits(
      hdc,
      hbitmap,
      0,
      height as u32,
      Some(bgra.as_mut_ptr() as *mut core::ffi::c_void),
      &mut bmi,
      DIB_RGB_COLORS
    );
    let _ = DeleteDC(hdc);
    if got == 0 {
      return None;
    }

    for px in bgra.chunks_exact_mut(4) {
      px.swap(0, 2);
    }

    let image = image::RgbaImage::from_raw(width as u32, height as u32, bgra)?;
    let mut out = Vec::new();
    image
      .write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
      .ok()?;
    Some(out)
  }
}

#[napi(object)]
pub struct StartApp {
  pub name: String,
  pub app_id: String,
}

/// Enumerates packaged (MSIX/UWP) Start Menu apps by walking the virtual
/// `shell:AppsFolder`, replacing the `Get-StartApps` PowerShell cmdlet. Only items
/// whose AppUserModelID contains `!` (PackageFamilyName!AppId) are packaged apps;
/// classic desktop apps also show up in this folder but are already covered by the
/// `.lnk` shortcuts collected separately, so they're filtered out here.
#[napi]
pub fn list_start_apps() -> Vec<StartApp> {
  let _com = ComGuard::new();
  let mut results = Vec::new();
  unsafe {
    let wname = HSTRING::from("shell:AppsFolder");
    let folder: IShellItem = match SHCreateItemFromParsingName(&wname, None) {
      Ok(f) => f,
      Err(_) => return results,
    };
    let enum_items: IEnumShellItems = match folder.BindToHandler(None, &BHID_EnumItems) {
      Ok(e) => e,
      Err(_) => return results,
    };

    loop {
      let mut items: [Option<IShellItem>; 1] = [None];
      let mut fetched = 0u32;
      if enum_items.Next(&mut items, Some(&mut fetched)).is_err() || fetched == 0 {
        break;
      }
      let Some(item) = items[0].take() else { break };

      let Ok(item2) = item.cast::<IShellItem2>() else { continue };
      let Ok(app_id_pwstr) = item2.GetString(&PKEY_AppUserModel_ID) else { continue };
      let app_id = app_id_pwstr.to_string().unwrap_or_default();
      CoTaskMemFree(Some(app_id_pwstr.0 as *const core::ffi::c_void));
      if !app_id.contains('!') {
        continue;
      }

      let name = match item2.GetString(&PKEY_ItemNameDisplay) {
        Ok(p) => {
          let s = p.to_string().unwrap_or_default();
          CoTaskMemFree(Some(p.0 as *const core::ffi::c_void));
          s
        }
        Err(_) => match item.GetDisplayName(SIGDN_NORMALDISPLAY) {
          Ok(p) => {
            let s = p.to_string().unwrap_or_default();
            CoTaskMemFree(Some(p.0 as *const core::ffi::c_void));
            s
          }
          Err(_) => String::new(),
        }
      };

      if name.is_empty() {
        continue;
      }
      results.push(StartApp { name, app_id });
    }
  }
  results
}
