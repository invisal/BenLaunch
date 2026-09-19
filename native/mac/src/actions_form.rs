//! A native form screen for the Actions panel: the same glass `NSPanel`, but
//! with a header, one input (a text field, or a key-combo recorder), a status
//! line and Cancel / Save buttons instead of a searchable list. It's what a menu
//! row that needs a little custom content — "Set Alias…", "Set Hotkey…" — opens.
//!
//! Unlike the list, a form outlives its first event: `submit` is reported and
//! the form stays up (buttons disabled, "Saving…") until the caller either
//! dismisses it (`close_actions_form`) or reports a problem (`fail_actions_form`),
//! which re-arms it so the user can try again.

use std::cell::RefCell;

use napi::bindgen_prelude::{Buffer, Function};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Error, Result, Status};
use napi_derive::napi;
use objc2::rc::{Retained, Weak};
use objc2::runtime::{AnyObject, Bool, ProtocolObject, Sel};
use objc2::{
  define_class, msg_send, sel, AnyThread, DefinedClass, MainThreadMarker, MainThreadOnly, Message,
};
use objc2_app_kit::{
  NSBezelStyle, NSButton, NSColor, NSControl, NSControlTextEditingDelegate, NSEvent,
  NSEventModifierFlags, NSFocusRingType, NSFont, NSImage, NSImageView, NSLayoutAttribute,
  NSStackView, NSTextAlignment, NSTextField, NSTextFieldBezelStyle, NSTextFieldDelegate,
  NSTextView, NSUserInterfaceLayoutOrientation, NSView, NSWindow, NSWindowDelegate,
  NSLayoutConstraintOrientation,
};
use objc2_foundation::{
  NSData, NSDataBase64DecodingOptions, NSNotification, NSObject, NSObjectProtocol, NSString,
};

use crate::actions_panel::{
  attach_panel, dismiss_current, keycaps, label, make_panel, parent_window, restore_parent_focus,
  ActionsPanel,
};

const TEXT_FORM_HEIGHT: f64 = 136.0;
const KEYS_FORM_HEIGHT: f64 = 182.0;
const RECORDER_HEIGHT: f64 = 92.0;
const FIELD_HEIGHT: f64 = 28.0;
const FOOTER_HEIGHT: f64 = 28.0;
const SIDE_INSET: f64 = 12.0;

/// What a form shows. `kind` is `"text"` (a text field) or `"keys"` (records the
/// next key combo, as an Electron accelerator like `Command+Shift+K`).
#[napi(object)]
pub struct ActionsFormSpec {
  pub kind: String,
  pub title: String,
  /// A glyph (emoji) shown before the title.
  pub icon_text: Option<String>,
  /// A `data:image/...;base64,` icon shown before the title.
  pub icon_data_url: Option<String>,
  /// Text mode: the field's starting content.
  pub initial_value: Option<String>,
  /// Text mode: the field's placeholder.
  pub placeholder: Option<String>,
  /// Text mode: drop whitespace as it's typed.
  pub strip_whitespace: Option<bool>,
  /// Left button, default "Cancel".
  pub cancel_label: Option<String>,
  /// Right (primary) button, default "Save".
  pub submit_label: Option<String>,
  /// The primary button's title while saving, default "Saving…".
  pub loading_label: Option<String>,
}

/// What a form reports: `kind` is `"submit"` (with the `value`) or `"cancel"`
/// (with `value` `"back"` if the user chose to leave, `"dismissed"` if it was lost).
#[napi(object)]
pub struct FormEvent {
  pub kind: String,
  pub value: Option<String>,
}

type FormEventFn = ThreadsafeFunction<FormEvent, (), FormEvent, Status, false>;

struct RecorderIvars {
  delegate: Weak<FormDelegate>,
}

define_class!(
  /// The key-combo box: takes keyboard focus and hands every key press —
  /// including ⌘-chords, which arrive as key equivalents — to the form.
  #[unsafe(super(NSView))]
  #[thread_kind = MainThreadOnly]
  #[name = "BenLaunchKeyRecorder"]
  #[ivars = RecorderIvars]
  struct KeyRecorder;

  impl KeyRecorder {
    #[unsafe(method(acceptsFirstResponder))]
    fn accepts_first_responder(&self) -> bool {
      true
    }

    #[unsafe(method(keyDown:))]
    fn key_down(&self, event: &NSEvent) {
      self.forward(event);
    }

    #[unsafe(method(performKeyEquivalent:))]
    fn perform_key_equivalent(&self, event: &NSEvent) -> Bool {
      self.forward(event);
      Bool::YES
    }
  }
);

impl KeyRecorder {
  fn new(mtm: MainThreadMarker, delegate: &FormDelegate) -> Retained<Self> {
    let this = mtm.alloc::<Self>().set_ivars(RecorderIvars {
      delegate: Weak::new(&delegate.retain()),
    });
    unsafe { msg_send![super(this), init] }
  }

  fn forward(&self, event: &NSEvent) {
    if let Some(delegate) = self.ivars().delegate.load() {
      delegate.record(event);
    }
  }
}

enum Body {
  Text(Retained<NSTextField>),
  Keys {
    /// The big line showing the recorded combo.
    combo: Retained<NSTextField>,
  },
}

struct FormState {
  panel: Retained<ActionsPanel>,
  parent: Retained<NSWindow>,
  body: Body,
  /// Errors and hints: under the field, or inside the recorder.
  status: Retained<NSTextField>,
  primary: Retained<NSButton>,
  submit_label: String,
  loading_label: String,
  strip_whitespace: bool,
  /// Keys mode: the recorded accelerator, not yet submitted.
  pending: Option<String>,
  saving: bool,
  on_event: FormEventFn,
}

struct DelegateIvars {
  state: RefCell<Option<FormState>>,
}

define_class!(
  #[unsafe(super(NSObject))]
  #[thread_kind = MainThreadOnly]
  #[name = "BenLaunchFormDelegate"]
  #[ivars = DelegateIvars]
  struct FormDelegate;

  unsafe impl NSObjectProtocol for FormDelegate {}

  unsafe impl NSControlTextEditingDelegate for FormDelegate {
    #[unsafe(method(controlTextDidChange:))]
    fn control_text_did_change(&self, _notification: &NSNotification) {
      self.sanitize();
    }

    #[unsafe(method(control:textView:doCommandBySelector:))]
    fn do_command(&self, _control: &NSControl, _text_view: &NSTextView, command: Sel) -> Bool {
      if command == sel!(insertNewline:) {
        self.submit();
      } else if command == sel!(cancelOperation:) {
        self.teardown(Some("back"));
      } else {
        return Bool::NO;
      }
      Bool::YES
    }
  }

  unsafe impl NSTextFieldDelegate for FormDelegate {}

  unsafe impl NSWindowDelegate for FormDelegate {
    #[unsafe(method(windowDidResignKey:))]
    fn window_did_resign_key(&self, _notification: &NSNotification) {
      self.teardown(Some("dismissed"));
    }
  }

  impl FormDelegate {
    #[unsafe(method(primaryClicked:))]
    fn primary_clicked(&self, _sender: Option<&AnyObject>) {
      self.submit();
    }

    #[unsafe(method(secondaryClicked:))]
    fn secondary_clicked(&self, _sender: Option<&AnyObject>) {
      self.teardown(Some("back"));
    }
  }
);

thread_local! {
  /// Keeps the open form's delegate (and through it, all state) alive.
  static CURRENT_FORM: RefCell<Option<Retained<FormDelegate>>> = const { RefCell::new(None) };
}

impl FormDelegate {
  fn new(mtm: MainThreadMarker) -> Retained<Self> {
    let this = mtm.alloc::<Self>().set_ivars(DelegateIvars {
      state: RefCell::new(None),
    });
    unsafe { msg_send![super(this), init] }
  }

  /// Text mode: strip whitespace as it's typed, if asked to.
  fn sanitize(&self) {
    let guard = self.ivars().state.borrow();
    let Some(state) = guard.as_ref() else { return };
    let Body::Text(field) = &state.body else { return };
    if !state.strip_whitespace {
      return;
    }
    let current = field.stringValue().to_string();
    let cleaned: String = current.chars().filter(|c| !c.is_whitespace()).collect();
    if cleaned != current {
      field.setStringValue(&NSString::from_str(&cleaned));
    }
  }

  /// Reports the value and locks the form until the caller answers.
  fn submit(&self) {
    let mut guard = self.ivars().state.borrow_mut();
    let Some(state) = guard.as_mut() else { return };
    if state.saving {
      return;
    }
    let value = match &state.body {
      Body::Text(field) => Some(field.stringValue().to_string()),
      Body::Keys { .. } => state.pending.clone(),
    };
    let Some(value) = value else { return };

    state.saving = true;
    state.primary.setEnabled(false);
    state.primary.setTitle(&NSString::from_str(&state.loading_label));
    state.status.setStringValue(&NSString::from_str(""));
    state.on_event.call(
      FormEvent {
        kind: "submit".into(),
        value: Some(value),
      },
      ThreadsafeFunctionCallMode::NonBlocking,
    );
  }

  /// Keys mode: turn a key press into the pending accelerator.
  fn record(&self, event: &NSEvent) {
    if event.isARepeat() {
      return;
    }
    let code = event.keyCode();
    let flags = event.modifierFlags();
    let has_modifier = flags.intersects(
      NSEventModifierFlags::Command
        | NSEventModifierFlags::Control
        | NSEventModifierFlags::Option
        | NSEventModifierFlags::Shift,
    );

    {
      let guard = self.ivars().state.borrow();
      let Some(state) = guard.as_ref() else { return };
      if state.saving {
        return;
      }
      // A bare Enter confirms the pending combo; with a modifier held it is a
      // candidate itself (binding ⌘⏎ is still possible).
      if matches!(code, 36 | 76) && !has_modifier && state.pending.is_some() {
        drop(guard);
        self.submit();
        return;
      }
      if code == 53 {
        drop(guard);
        self.teardown(Some("back"));
        return;
      }
    }

    let Some(key) = key_name(code) else { return };
    let mut modifiers = Vec::new();
    if flags.contains(NSEventModifierFlags::Command) {
      modifiers.push("Command");
    }
    if flags.contains(NSEventModifierFlags::Control) {
      modifiers.push("Control");
    }
    if flags.contains(NSEventModifierFlags::Option) {
      modifiers.push("Option");
    }
    if flags.contains(NSEventModifierFlags::Shift) {
      modifiers.push("Shift");
    }
    // A global shortcut needs a modifier so it doesn't collide with typing.
    if modifiers.is_empty() {
      return;
    }
    modifiers.push(key);
    let accelerator = modifiers.join("+");

    let mut guard = self.ivars().state.borrow_mut();
    let Some(state) = guard.as_mut() else { return };
    if let Body::Keys { combo } = &state.body {
      combo.setStringValue(&NSString::from_str(&display_accelerator(&accelerator)));
    }
    state.status.setTextColor(Some(&NSColor::secondaryLabelColor()));
    state.status.setStringValue(&NSString::from_str("Press Enter to confirm"));
    state.pending = Some(accelerator);
    state.primary.setEnabled(true);
  }

  /// The caller couldn't save: show why and let the user try again.
  fn fail(&self, message: &str) {
    let mut guard = self.ivars().state.borrow_mut();
    let Some(state) = guard.as_mut() else { return };
    state.saving = false;
    state.pending = None;
    state.primary.setTitle(&NSString::from_str(&state.submit_label));
    // Keys mode needs a fresh combo before it can save again.
    state.primary.setEnabled(matches!(state.body, Body::Text(_)));
    if let Body::Keys { combo } = &state.body {
      combo.setStringValue(&NSString::from_str("⌘"));
    }
    state.status.setTextColor(Some(&NSColor::systemRedColor()));
    state.status.setStringValue(&NSString::from_str(message));
  }

  /// Closes the form. `reason` is reported as a `cancel` event — `"back"` when the
  /// user asked to leave (Esc, the Cancel button), `"dismissed"` when the form
  /// was lost some other way (focus moved elsewhere, another panel replaced it) —
  /// or `None` to stay silent, for the caller's own `close_actions_form`.
  /// Idempotent: closing resigns key, which re-enters here.
  fn teardown(&self, reason: Option<&str>) {
    let Some(state) = self.ivars().state.borrow_mut().take() else {
      return;
    };
    state.panel.setDelegate(None);
    state.parent.removeChildWindow(&state.panel);
    state.panel.orderOut(None);
    restore_parent_focus(&state.parent);
    if let Some(reason) = reason {
      state.on_event.call(
        FormEvent {
          kind: "cancel".into(),
          value: Some(reason.into()),
        },
        ThreadsafeFunctionCallMode::NonBlocking,
      );
    }
    CURRENT_FORM.with(|c| c.borrow_mut().take());
  }
}

/// macOS virtual key code -> the key name Electron accelerators use. These are
/// physical keys (ANSI layout positions), like the renderer's `event.code`.
fn key_name(code: u16) -> Option<&'static str> {
  Some(match code {
    0 => "A", 11 => "B", 8 => "C", 2 => "D", 14 => "E", 3 => "F", 5 => "G", 4 => "H",
    34 => "I", 38 => "J", 40 => "K", 37 => "L", 46 => "M", 45 => "N", 31 => "O", 35 => "P",
    12 => "Q", 15 => "R", 1 => "S", 17 => "T", 32 => "U", 9 => "V", 13 => "W", 7 => "X",
    16 => "Y", 6 => "Z",
    29 => "0", 18 => "1", 19 => "2", 20 => "3", 21 => "4", 23 => "5", 22 => "6", 26 => "7",
    28 => "8", 25 => "9",
    122 => "F1", 120 => "F2", 99 => "F3", 118 => "F4", 96 => "F5", 97 => "F6", 98 => "F7",
    100 => "F8", 101 => "F9", 109 => "F10", 103 => "F11", 111 => "F12", 105 => "F13",
    107 => "F14", 113 => "F15", 106 => "F16", 64 => "F17", 79 => "F18", 80 => "F19", 90 => "F20",
    49 => "Space", 126 => "Up", 125 => "Down", 123 => "Left", 124 => "Right", 48 => "Tab",
    36 | 76 => "Return", 51 => "Backspace", 117 => "Delete",
    43 => ",", 47 => ".", 44 => "/", 42 => "\\", 41 => ";", 39 => "'", 33 => "[", 30 => "]",
    27 => "-", 24 => "=", 50 => "`",
    _ => return None,
  })
}

/// `Command+Shift+K` -> `⌘⇧K`, the way the renderer's `formatShortcut` does on
/// macOS: symbols run together, a word like "Space" gets a leading gap.
fn display_accelerator(accelerator: &str) -> String {
  let mut out = String::new();
  for (i, token) in accelerator.split('+').filter(|t| !t.is_empty()).enumerate() {
    let shown = match token.to_lowercase().as_str() {
      "command" => "⌘".to_string(),
      "control" => "⌃".to_string(),
      "option" => "⌥".to_string(),
      "shift" => "⇧".to_string(),
      "space" => "Space".to_string(),
      "return" => "⏎".to_string(),
      "backspace" => "⌫".to_string(),
      "delete" => "⌦".to_string(),
      "escape" => "⎋".to_string(),
      "tab" => "⇥".to_string(),
      "up" => "↑".to_string(),
      "down" => "↓".to_string(),
      "left" => "←".to_string(),
      "right" => "→".to_string(),
      _ => token.to_uppercase(),
    };
    if i > 0 && shown.chars().count() > 1 {
      out.push(' ');
    }
    out.push_str(&shown);
  }
  out
}

/// An icon image from a `data:image/...;base64,` URL.
fn image_from_data_url(mtm: MainThreadMarker, url: &str) -> Option<Retained<NSImage>> {
  let (_, encoded) = url.split_once(";base64,")?;
  let data = NSData::initWithBase64EncodedString_options(
    NSData::alloc(),
    &NSString::from_str(encoded),
    NSDataBase64DecodingOptions::IgnoreUnknownCharacters,
  )?;
  NSImage::initWithData(mtm.alloc(), &data)
}

/// Pins `view` inside `parent` with autolayout.
fn pin(view: &NSView, parent: &NSView, leading: f64, trailing: f64) {
  view.setTranslatesAutoresizingMaskIntoConstraints(false);
  parent.addSubview(view);
  view
    .leadingAnchor()
    .constraintEqualToAnchor_constant(&parent.leadingAnchor(), leading)
    .setActive(true);
  view
    .trailingAnchor()
    .constraintEqualToAnchor_constant(&parent.trailingAnchor(), -trailing)
    .setActive(true);
}

/// Shows a form anchored to the bottom-right of `parent_view`'s window, replacing
/// whatever panel is open. `on_event` is called with `{ kind: "submit", value }`
/// each time the user saves (the form then waits — see `fail_actions_form` and
/// `close_actions_form`), and with `{ kind: "cancel" }` when it's dismissed by
/// the user (`"back"`: Esc, Cancel) or lost (`"dismissed"`: focus moved away, or
/// another panel replaced it).
#[napi(ts_args_type = "parentView: Buffer, spec: ActionsFormSpec, onEvent: (event: FormEvent) => void")]
pub fn show_actions_form(
  parent_view: Buffer,
  spec: ActionsFormSpec,
  on_event: Function<FormEvent, ()>,
) -> Result<()> {
  let mtm = MainThreadMarker::new()
    .ok_or_else(|| Error::new(Status::GenericFailure, "not on the AppKit main thread"))?;
  let keys_mode = match spec.kind.as_str() {
    "text" => false,
    "keys" => true,
    other => {
      return Err(Error::new(
        Status::InvalidArg,
        format!("unknown form kind `{other}` (expected \"text\" or \"keys\")"),
      ))
    }
  };
  let on_event: FormEventFn = on_event
    .build_threadsafe_function::<FormEvent>()
    .callee_handled::<false>()
    .build()?;
  let parent = parent_window(&parent_view)?;

  dismiss_current();

  let height = if keys_mode { KEYS_FORM_HEIGHT } else { TEXT_FORM_HEIGHT };
  let (panel, content) = make_panel(mtm, &parent, height);
  let delegate = FormDelegate::new(mtm);
  let target: &AnyObject = &delegate;

  // Header: an optional icon, then the title.
  let header = NSStackView::new(mtm);
  header.setOrientation(NSUserInterfaceLayoutOrientation::Horizontal);
  header.setSpacing(6.0);
  if let Some(image) = spec
    .icon_data_url
    .as_deref()
    .and_then(|url| image_from_data_url(mtm, url))
  {
    let icon = NSImageView::imageViewWithImage(&image, mtm);
    icon.widthAnchor().constraintEqualToConstant(14.0).setActive(true);
    icon.heightAnchor().constraintEqualToConstant(14.0).setActive(true);
    header.addArrangedSubview(&icon);
  } else if let Some(glyph) = spec.icon_text.as_deref().filter(|g| !g.is_empty()) {
    header.addArrangedSubview(&label(mtm, glyph, 12.0, &NSColor::secondaryLabelColor()));
  }
  header.addArrangedSubview(&label(mtm, &spec.title, 12.0, &NSColor::secondaryLabelColor()));
  pin(&header, &content, 14.0, 14.0);
  header
    .topAnchor()
    .constraintEqualToAnchor_constant(&content.topAnchor(), 14.0)
    .setActive(true);

  // Body.
  let status = label(mtm, "", 12.0, &NSColor::secondaryLabelColor());
  let (body, focus): (Body, Retained<NSView>);
  if keys_mode {
    let recorder = KeyRecorder::new(mtm, &delegate);
    recorder.setWantsLayer(true);
    // SAFETY: the layer exists once `wantsLayer` is set; colours go through KVC
    // as `id` (see `actions_panel::set_row_highlight`).
    unsafe {
      let layer: *mut AnyObject = msg_send![&*recorder, layer];
      let border = NSColor::whiteColor().colorWithAlphaComponent(0.22);
      let fill = NSColor::whiteColor().colorWithAlphaComponent(0.06);
      let border_cg: *mut AnyObject = msg_send![&*border, CGColor];
      let fill_cg: *mut AnyObject = msg_send![&*fill, CGColor];
      let _: () = msg_send![layer, setCornerRadius: 8.0_f64];
      let _: () = msg_send![layer, setBorderWidth: 1.0_f64];
      let _: () = msg_send![layer, setValue: border_cg, forKey: &*NSString::from_str("borderColor")];
      let _: () = msg_send![layer, setValue: fill_cg, forKey: &*NSString::from_str("backgroundColor")];
    }
    pin(&recorder, &content, SIDE_INSET, SIDE_INSET);
    recorder.heightAnchor().constraintEqualToConstant(RECORDER_HEIGHT).setActive(true);
    recorder
      .topAnchor()
      .constraintEqualToAnchor_constant(&header.bottomAnchor(), 10.0)
      .setActive(true);

    let combo = label(mtm, "⌘", 22.0, &NSColor::labelColor());
    combo.setAlignment(NSTextAlignment::Center);
    status.setAlignment(NSTextAlignment::Center);
    status.setStringValue(&NSString::from_str("Press a key combo…"));
    let column = NSStackView::new(mtm);
    column.setOrientation(NSUserInterfaceLayoutOrientation::Vertical);
    column.setAlignment(NSLayoutAttribute::CenterX);
    column.setSpacing(6.0);
    column.addArrangedSubview(&combo);
    column.addArrangedSubview(&status);
    column.setTranslatesAutoresizingMaskIntoConstraints(false);
    recorder.addSubview(&column);
    column
      .centerXAnchor()
      .constraintEqualToAnchor(&recorder.centerXAnchor())
      .setActive(true);
    column
      .centerYAnchor()
      .constraintEqualToAnchor(&recorder.centerYAnchor())
      .setActive(true);

    body = Body::Keys { combo };
    focus = Retained::into_super(recorder);
  } else {
    let field = NSTextField::new(mtm);
    field.setEditable(true);
    field.setBezeled(true);
    field.setBezelStyle(NSTextFieldBezelStyle::RoundedBezel);
    field.setFocusRingType(NSFocusRingType::None);
    field.setFont(Some(&NSFont::systemFontOfSize(14.0)));
    field.setPlaceholderString(spec.placeholder.as_deref().map(NSString::from_str).as_deref());
    field.setStringValue(&NSString::from_str(spec.initial_value.as_deref().unwrap_or("")));
    // SAFETY: the delegate is kept alive by `CURRENT_FORM` until teardown.
    unsafe { field.setDelegate(Some(ProtocolObject::from_ref(&*delegate))) };
    pin(&field, &content, SIDE_INSET, SIDE_INSET);
    field.heightAnchor().constraintEqualToConstant(FIELD_HEIGHT).setActive(true);
    field
      .topAnchor()
      .constraintEqualToAnchor_constant(&header.bottomAnchor(), 10.0)
      .setActive(true);

    status.setTextColor(Some(&NSColor::systemRedColor()));
    status.setFont(Some(&NSFont::systemFontOfSize(11.0)));
    pin(&status, &content, 14.0, 14.0);
    status
      .topAnchor()
      .constraintEqualToAnchor_constant(&field.bottomAnchor(), 4.0)
      .setActive(true);

    body = Body::Text(field.clone());
    focus = Retained::into_super(Retained::into_super(field));
  }

  // Footer: [Cancel ⎋] ........ [Save ⏎]
  let cancel_label = spec.cancel_label.clone().unwrap_or_else(|| "Cancel".into());
  let submit_label = spec.submit_label.clone().unwrap_or_else(|| "Save".into());
  let loading_label = spec.loading_label.clone().unwrap_or_else(|| "Saving…".into());

  // SAFETY: `target` (the delegate) outlives both buttons; it is kept alive in
  // `CURRENT_FORM`, and the selectors are defined on `FormDelegate`.
  let (secondary, primary) = unsafe {
    (
      NSButton::buttonWithTitle_target_action(
        &NSString::from_str(&cancel_label),
        Some(target),
        Some(sel!(secondaryClicked:)),
        mtm,
      ),
      NSButton::buttonWithTitle_target_action(
        &NSString::from_str(&submit_label),
        Some(target),
        Some(sel!(primaryClicked:)),
        mtm,
      ),
    )
  };
  secondary.setBordered(false);
  primary.setBezelStyle(NSBezelStyle::Push);
  primary.setBezelColor(Some(&NSColor::controlAccentColor()));
  // Keys mode can't save until a combo has been recorded.
  primary.setEnabled(!keys_mode);

  let spacer = NSView::new(mtm);
  spacer.setContentHuggingPriority_forOrientation(1.0, NSLayoutConstraintOrientation::Horizontal);
  let footer = NSStackView::new(mtm);
  footer.setOrientation(NSUserInterfaceLayoutOrientation::Horizontal);
  footer.setSpacing(6.0);
  footer.addArrangedSubview(&secondary);
  footer.addArrangedSubview(&keycaps(mtm, "Esc"));
  footer.addArrangedSubview(&spacer);
  footer.addArrangedSubview(&primary);
  footer.addArrangedSubview(&keycaps(mtm, "⏎"));
  pin(&footer, &content, SIDE_INSET, SIDE_INSET);
  footer.heightAnchor().constraintEqualToConstant(FOOTER_HEIGHT).setActive(true);
  footer
    .bottomAnchor()
    .constraintEqualToAnchor_constant(&content.bottomAnchor(), -10.0)
    .setActive(true);

  panel.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
  *delegate.ivars().state.borrow_mut() = Some(FormState {
    panel: panel.clone(),
    parent: parent.clone(),
    body,
    status,
    primary,
    submit_label,
    loading_label,
    strip_whitespace: spec.strip_whitespace.unwrap_or(false),
    pending: None,
    saving: false,
    on_event,
  });
  CURRENT_FORM.with(|c| *c.borrow_mut() = Some(delegate.clone()));

  attach_panel(&parent, &panel, &focus);
  if let Some(state) = delegate.ivars().state.borrow().as_ref() {
    if let Body::Text(field) = &state.body {
      // SAFETY: plain AppKit call on a live field.
      unsafe { field.selectText(None) };
    }
  }
  Ok(())
}

/// Tells the open form its save failed: it shows `message` and lets the user
/// try again. Does nothing if no form is open.
#[napi]
pub fn fail_actions_form(message: String) {
  if let Some(delegate) = CURRENT_FORM.with(|c| c.borrow().clone()) {
    delegate.fail(&message);
  }
}

/// Closes the form without reporting anything back — the caller is done with it.
#[napi]
pub fn close_actions_form() {
  if let Some(delegate) = CURRENT_FORM.with(|c| c.borrow().clone()) {
    delegate.teardown(None);
  }
}

/// Closes the form because something else is taking the panel's place: the
/// caller is told (`cancel`) so it stops waiting.
pub(crate) fn dismiss_form() {
  if let Some(delegate) = CURRENT_FORM.with(|c| c.borrow().clone()) {
    delegate.teardown(Some("dismissed"));
  }
}
