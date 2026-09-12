#![cfg(target_os = "linux")]
//! Native Linux (X11/XWayland) window control for benpocket-launcher.
//!
//! Replaces the previous `xdotool`/`wmctrl` shell-outs with direct EWMH-over-X11
//! calls via `x11rb`'s pure-Rust connection (`rust_connection` — no libxcb C
//! dependency, just a Unix-domain-socket connection to the X server). Every
//! operation here mirrors what those two tools do internally:
//! - `active_window` reads `_NET_ACTIVE_WINDOW` off the root window, same as
//!   `xdotool getactivewindow`.
//! - `get_window_rect` translates the window's origin to root coordinates, same
//!   as `xdotool getwindowgeometry` — `_NET_ACTIVE_WINDOW` is defined by the EWMH
//!   spec to be a *client* window, not the window manager's decoration frame, so
//!   no reparent-walking is needed.
//! - `apply_window_rect`/`toggle_fullscreen` send `_NET_WM_STATE` client messages
//!   to the root window, the same EWMH mechanism `wmctrl -b ...` drives.
//!
//! A single connection is opened lazily and cached for the process's lifetime
//! instead of reconnecting (and forking a whole process) per call.
//!
//! This is a hard platform limit, not a gap here: both this and `xdotool`/
//! `wmctrl` operate on X11 (which includes XWayland-backed windows under a
//! Wayland session — most apps, today), but a **Wayland-native** window cannot
//! be moved by any external process on Linux. Wayland's security model has no
//! cross-app window-control protocol; there is no workaround from here.

use napi_derive::napi;
use std::sync::OnceLock;
use x11rb::connection::Connection;
use x11rb::protocol::xproto::{
  Atom, AtomEnum, ClientMessageEvent, ConfigureWindowAux, ConnectionExt, EventMask, Window,
};
use x11rb::rust_connection::RustConnection;

struct X11 {
  conn: RustConnection,
  root: Window,
}

static X11_CONN: OnceLock<Option<X11>> = OnceLock::new();

/// The cached connection + root window, established on first use. `None` if the
/// connection itself failed (no X server/XWayland reachable at all) — every
/// exported function below treats that the same as "command failed."
fn x11() -> Option<&'static X11> {
  X11_CONN
    .get_or_init(|| {
      let (conn, screen_num) = RustConnection::connect(None).ok()?;
      let root = conn.setup().roots.get(screen_num)?.root;
      Some(X11 { conn, root })
    })
    .as_ref()
}

fn atom(conn: &RustConnection, name: &str) -> Option<Atom> {
  conn.intern_atom(false, name.as_bytes()).ok()?.reply().ok().map(|reply| reply.atom)
}

/// EWMH `_NET_WM_STATE` action codes (spec-defined, not part of the core X11
/// protocol).
const NET_WM_STATE_REMOVE: u32 = 0;
const NET_WM_STATE_TOGGLE: u32 = 2;

/// Sends a `_NET_WM_STATE` client message to the root window — the EWMH
/// mechanism every spec-compliant window manager listens on for state changes
/// (maximize, fullscreen, …) a client wants to request for itself. `prop2` of
/// `0` (the X11 "None" atom) is fine when only one property is being touched.
fn send_wm_state(x11: &X11, window: Window, action: u32, prop1: Atom, prop2: Atom) -> bool {
  let Some(net_wm_state) = atom(&x11.conn, "_NET_WM_STATE") else {
    return false;
  };
  // Source indication `1` = "normal application" per the EWMH spec.
  let event = ClientMessageEvent::new(32, window, net_wm_state, [action, prop1, prop2, 1, 0]);
  let mask = EventMask::SUBSTRUCTURE_NOTIFY | EventMask::SUBSTRUCTURE_REDIRECT;
  x11.conn.send_event(false, x11.root, mask, event).is_ok() && x11.conn.flush().is_ok()
}

/// The active window's id, or `0` if none (or the only candidate was `exclude`
/// — the launcher's own X11 window id, so a stray capture of the launcher
/// itself is discarded rather than moved later).
#[napi]
pub fn active_window(exclude: i64) -> i64 {
  let Some(x11) = x11() else {
    return 0;
  };
  let Some(net_active) = atom(&x11.conn, "_NET_ACTIVE_WINDOW") else {
    return 0;
  };
  let Ok(cookie) = x11.conn.get_property(false, x11.root, net_active, AtomEnum::WINDOW, 0, 1)
  else {
    return 0;
  };
  let Ok(reply) = cookie.reply() else {
    return 0;
  };
  let id = reply.value32().and_then(|mut values| values.next()).unwrap_or(0);
  if id != 0 && id as i64 != exclude {
    id as i64
  } else {
    0
  }
}

/// Whether any X11/XWayland window exists at all right now — checked via
/// `_NET_CLIENT_LIST` on the root window, and `false` if the X11 connection
/// itself can't be established (e.g. a pure-Wayland session with no XWayland).
/// A window-management feature offered on a desktop with zero reachable
/// windows would just silently no-op every command, so this is used to hide
/// the feature entirely instead.
#[napi]
pub fn has_xwayland_windows() -> bool {
  let Some(x11) = x11() else {
    return false;
  };
  let Some(client_list) = atom(&x11.conn, "_NET_CLIENT_LIST") else {
    return false;
  };
  let Ok(cookie) =
    x11.conn.get_property(false, x11.root, client_list, AtomEnum::WINDOW, 0, u32::MAX)
  else {
    return false;
  };
  let Ok(reply) = cookie.reply() else {
    return false;
  };
  reply.value32().map(|values| values.count() > 0).unwrap_or(false)
}

#[napi(object)]
pub struct LinuxRect {
  pub x: f64,
  pub y: f64,
  pub width: f64,
  pub height: f64,
}

/// The window's current position (translated to root/screen coordinates) and
/// size, or `null` if unavailable (invalid id, or the X11 connection is down).
#[napi]
pub fn get_window_rect(id: i64) -> Option<LinuxRect> {
  let x11 = x11()?;
  let window = id as u32;

  let geometry = x11.conn.get_geometry(window).ok()?.reply().ok()?;
  let translated = x11.conn.translate_coordinates(window, x11.root, 0, 0).ok()?.reply().ok()?;

  Some(LinuxRect {
    x: translated.dst_x as f64,
    y: translated.dst_y as f64,
    width: geometry.width as f64,
    height: geometry.height as f64,
  })
}

/// Moves and resizes the window to `rect`. Unmaximizes first — most window
/// managers ignore a `ConfigureWindow` resize/move on an already-maximized
/// window, the same reason the mac/Windows paths restore the window before
/// repositioning it. That step is best-effort (a window that was never
/// maximized has nothing to remove, and this shouldn't block the actual move);
/// the `ConfigureWindow` call is what determines the return value.
#[napi]
pub fn apply_window_rect(id: i64, rect: LinuxRect) -> bool {
  let Some(x11) = x11() else {
    return false;
  };
  let window = id as u32;

  if let (Some(vert), Some(horz)) = (
    atom(&x11.conn, "_NET_WM_STATE_MAXIMIZED_VERT"),
    atom(&x11.conn, "_NET_WM_STATE_MAXIMIZED_HORZ"),
  ) {
    send_wm_state(x11, window, NET_WM_STATE_REMOVE, vert, horz);
  }

  let aux = ConfigureWindowAux::new()
    .x(rect.x.round() as i32)
    .y(rect.y.round() as i32)
    .width(rect.width.round() as u32)
    .height(rect.height.round() as u32);

  x11.conn.configure_window(window, &aux).is_ok() && x11.conn.flush().is_ok()
}

/// Toggles EWMH `_NET_WM_STATE_FULLSCREEN` on the window — broadly supported
/// across X11 window managers (the same mechanism `wmctrl -b toggle,fullscreen`
/// drives).
#[napi]
pub fn toggle_fullscreen(id: i64) -> bool {
  let Some(x11) = x11() else {
    return false;
  };
  let Some(fullscreen) = atom(&x11.conn, "_NET_WM_STATE_FULLSCREEN") else {
    return false;
  };
  send_wm_state(x11, id as u32, NET_WM_STATE_TOGGLE, fullscreen, 0)
}
