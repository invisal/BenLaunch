//! A native Raycast-style "Actions" panel: a translucent, rounded `NSPanel`
//! attached to the launcher window, with a title, a list of rows (icon, label,
//! shortcut keycaps, section headers) and a search field at the bottom.
//!
//! Everything here runs on the AppKit main thread — in Electron that is the same
//! thread Node calls `#[napi]` functions on. The renderer never sees Objective-C:
//! it hands over plain `ActionsPanelItem`s and gets back the picked id (or a
//! close) through the callback.

use std::cell::{Cell, RefCell};

use napi::bindgen_prelude::{Buffer, Function};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Error, Result, Status};
use napi_derive::napi;
use objc2::rc::{Allocated, Retained, Weak};
use objc2::runtime::{AnyClass, AnyObject, Bool, ProtocolObject, Sel};
use objc2::{
  define_class, msg_send, sel, DefinedClass, MainThreadMarker, MainThreadOnly, Message,
};
use objc2_app_kit::{
  NSApplication, NSBackingStoreType, NSBorderType, NSColor, NSControl,
  NSControlTextEditingDelegate, NSEvent, NSFocusRingType, NSFont, NSImage, NSImageView,
  NSLayoutConstraintOrientation, NSPanel, NSScrollView, NSSearchField, NSSearchFieldDelegate,
  NSStackView, NSStackViewDistribution, NSTableColumn, NSTableColumnResizingOptions, NSTableView,
  NSTableViewColumnAutoresizingStyle, NSTableViewDataSource, NSTableViewDelegate,
  NSTableViewSelectionHighlightStyle, NSTableViewStyle, NSTextAlignment, NSTextField,
  NSTextFieldDelegate, NSTextView, NSTrackingArea, NSTrackingAreaOptions,
  NSUserInterfaceLayoutOrientation, NSView, NSVisualEffectBlendingMode, NSVisualEffectMaterial,
  NSVisualEffectState, NSVisualEffectView, NSWindow, NSWindowCollectionBehavior,
  NSWindowDelegate, NSWindowOrderingMode, NSWindowStyleMask,
};
use objc2_foundation::{
  NSEdgeInsets, NSInteger, NSNotification, NSObject, NSObjectProtocol, NSPoint, NSRect, NSSize, NSString,
};

pub(crate) const PANEL_WIDTH: f64 = 340.0;
const PANEL_HEIGHT: f64 = 400.0;
const ROW_HEIGHT: f64 = 34.0;
// Vertical metrics used to size the panel to its content (see `render`).
/// Space above the rows for the (fixed) title.
const TITLE_AREA_HEIGHT: f64 = 32.0;
/// Padding above the first and below the last row, inside the scroll view.
const LIST_VERTICAL_INSET: f64 = 4.0;
const LIST_SPACING: f64 = 2.0;
const HEADER_HEIGHT: f64 = 15.0;
/// Search field plus the gaps around it, below the list.
const SEARCH_AREA_HEIGHT: f64 = 44.0;
/// Past this the panel stops growing and its rows scroll.
const MAX_PANEL_HEIGHT: f64 = 400.0;
const MIN_PANEL_HEIGHT: f64 = 120.0;
const HIGHLIGHT_FADE_SECONDS: f64 = 0.15;
const PANEL_CORNER_RADIUS: f64 = 12.0;
const KEYCAP_PAD_X: f64 = 6.0;
const KEYCAP_PAD_Y: f64 = 2.0;
const KEYCAP_MIN_WIDTH: f64 = 20.0;
const KEYCAP_BORDER_WIDTH: f64 = 1.0;
const KEYCAP_BORDER_ALPHA: f64 = 0.22;

/// One row of the panel. Mirrors the renderer's `ActionsPanelItem`.
#[napi(object)]
#[derive(Clone)]
pub struct ActionsPanelItem {
  pub id: String,
  pub title: String,
  /// Rows sharing a section are grouped under a small header.
  pub section: Option<String>,
  /// Keycaps, e.g. `["⇧", "⌘", "F"]`.
  pub shortcut: Option<Vec<String>>,
  /// SF Symbol name, e.g. `"star"`.
  pub icon_sf_symbol: Option<String>,
  /// SF Symbol shown at the trailing edge, after any keycaps — e.g.
  /// `"chevron.right"` on a row that opens a submenu.
  pub accessory_sf_symbol: Option<String>,
  /// Plain text at the trailing edge where the keycaps would sit, for a value
  /// that isn't a shortcut (e.g. the current alias). Ignored if `shortcut` is set.
  pub hint: Option<String>,
  pub danger: Option<bool>,
}

/// What the panel reports back: `kind` is `"select"` (with `id`) or `"close"`.
#[napi(object)]
pub struct PanelEvent {
  pub kind: String,
  pub id: Option<String>,
}

type EventFn = ThreadsafeFunction<PanelEvent, (), PanelEvent, Status, false>;

struct State {
  panel: Retained<ActionsPanel>,
  parent: Retained<NSWindow>,
  search: Retained<NSSearchField>,
  /// Virtualized: only the rows in view exist as views (see the data-source
  /// methods on `PanelDelegate`), so a list of hundreds of apps opens instantly.
  table: Retained<NSTableView>,
  on_event: EventFn,
}

/// One line of the table: a section heading, or a row (by position in `filtered`).
enum DisplayRow {
  Header(String),
  Item(usize),
}

/// What the table shows. Kept apart from `State` because the table asks for it
/// (`numberOfRows`, `viewForRow`, ...) while `State` may be borrowed, e.g. in the
/// middle of `reloadData`.
struct Model {
  items: Vec<ActionsPanelItem>,
  /// Indices into `items` that match the search text.
  filtered: Vec<usize>,
  display: Vec<DisplayRow>,
  /// Display index of each `filtered` position.
  item_rows: Vec<usize>,
  /// Position within `filtered`.
  selected: usize,
}

impl Model {
  fn new(items: Vec<ActionsPanelItem>) -> Self {
    let mut model = Model {
      filtered: (0..items.len()).collect(),
      items,
      display: Vec::new(),
      item_rows: Vec::new(),
      selected: 0,
    };
    model.rebuild_display();
    model
  }

  /// Keeps the items whose title contains `query`, and resets the selection.
  fn filter(&mut self, query: &str) {
    let query = query.to_lowercase();
    self.filtered = self
      .items
      .iter()
      .enumerate()
      .filter(|(_, item)| query.is_empty() || item.title.to_lowercase().contains(&query))
      .map(|(i, _)| i)
      .collect();
    self.selected = 0;
    self.rebuild_display();
  }

  /// Lays `filtered` out as table lines: a heading before each new section.
  fn rebuild_display(&mut self) {
    self.display.clear();
    self.item_rows.clear();
    let mut last_section: Option<&str> = None;
    for (pos, &index) in self.filtered.iter().enumerate() {
      let section = self.items[index].section.as_deref();
      if let Some(name) = section.filter(|name| Some(*name) != last_section) {
        self.display.push(DisplayRow::Header(name.to_string()));
      }
      last_section = section;
      self.item_rows.push(self.display.len());
      self.display.push(DisplayRow::Item(pos));
    }
  }

  fn row_height(row: &DisplayRow) -> f64 {
    match row {
      DisplayRow::Header(_) => HEADER_HEIGHT,
      DisplayRow::Item(_) => ROW_HEIGHT,
    }
  }

  /// The panel height that fits the current lines, up to `MAX_PANEL_HEIGHT` —
  /// past that the scroll view takes over.
  fn panel_height(&self) -> f64 {
    let rows: f64 = self.display.iter().map(Self::row_height).sum();
    let gaps = LIST_SPACING * self.display.len().saturating_sub(1) as f64;
    (TITLE_AREA_HEIGHT + 2.0 * LIST_VERTICAL_INSET + rows + gaps + SEARCH_AREA_HEIGHT)
      .clamp(MIN_PANEL_HEIGHT, MAX_PANEL_HEIGHT)
  }
}

define_class!(
  /// Borderless panels refuse key status by default; the search field needs it.
  #[unsafe(super(NSPanel))]
  #[thread_kind = MainThreadOnly]
  #[name = "BenLaunchActionsPanel"]
  pub(crate) struct ActionsPanel;

  impl ActionsPanel {
    #[unsafe(method(canBecomeKeyWindow))]
    fn can_become_key_window(&self) -> bool {
      true
    }
  }
);

struct RowIvars {
  /// Position within the filtered list.
  pos: Cell<usize>,
  delegate: Weak<PanelDelegate>,
}

define_class!(
  /// A row: a layer-backed rounded highlight (so its colour can fade) that
  /// forwards the mouse to the panel — hover highlights it, one click selects
  /// it, a double click runs it.
  #[unsafe(super(NSView))]
  #[thread_kind = MainThreadOnly]
  #[name = "BenLaunchActionsRow"]
  #[ivars = RowIvars]
  struct RowBox;

  impl RowBox {
    /// Claim every click inside the row, so its labels and icons (which would
    /// otherwise become the hit view and swallow `mouseDown:`) never do.
    #[unsafe(method_id(hitTest:))]
    fn hit_test(&self, point: NSPoint) -> Option<Retained<NSView>> {
      let frame = self.frame();
      let inside = point.x >= frame.origin.x
        && point.x < frame.origin.x + frame.size.width
        && point.y >= frame.origin.y
        && point.y < frame.origin.y + frame.size.height;
      inside.then(|| Retained::into_super(self.retain()))
    }

    /// Only real pointer movement highlights a row, so a stationary pointer
    /// doesn't fight the arrow keys when the list rebuilds under it.
    #[unsafe(method(mouseMoved:))]
    fn mouse_moved(&self, _event: &NSEvent) {
      let ivars = self.ivars();
      if let Some(delegate) = ivars.delegate.load() {
        delegate.select_visible(ivars.pos.get());
      }
    }

    #[unsafe(method(mouseDown:))]
    fn mouse_down(&self, event: &NSEvent) {
      let ivars = self.ivars();
      if let Some(delegate) = ivars.delegate.load() {
        delegate.click(ivars.pos.get(), event.clickCount());
      }
    }
  }
);

impl RowBox {
  fn new(mtm: MainThreadMarker, pos: usize, delegate: &PanelDelegate) -> Retained<Self> {
    let this = mtm.alloc::<Self>().set_ivars(RowIvars {
      pos: Cell::new(pos),
      delegate: Weak::new(&delegate.retain()),
    });
    unsafe { msg_send![super(this), init] }
  }
}

struct DelegateIvars {
  state: RefCell<Option<State>>,
  model: RefCell<Model>,
}

define_class!(
  #[unsafe(super(NSObject))]
  #[thread_kind = MainThreadOnly]
  #[name = "BenLaunchActionsDelegate"]
  #[ivars = DelegateIvars]
  struct PanelDelegate;

  unsafe impl NSObjectProtocol for PanelDelegate {}

  unsafe impl NSControlTextEditingDelegate for PanelDelegate {
    #[unsafe(method(controlTextDidChange:))]
    fn control_text_did_change(&self, _notification: &NSNotification) {
      self.refilter();
    }

    #[unsafe(method(control:textView:doCommandBySelector:))]
    fn do_command(&self, _control: &NSControl, _text_view: &NSTextView, command: Sel) -> Bool {
      if command == sel!(moveUp:) {
        self.move_selection(-1);
      } else if command == sel!(moveDown:) {
        self.move_selection(1);
      } else if command == sel!(insertNewline:) {
        self.choose();
      } else if command == sel!(cancelOperation:) {
        self.finish(None);
      } else {
        return Bool::NO;
      }
      Bool::YES
    }
  }

  unsafe impl NSTextFieldDelegate for PanelDelegate {}
  unsafe impl NSSearchFieldDelegate for PanelDelegate {}

  unsafe impl NSWindowDelegate for PanelDelegate {
    #[unsafe(method(windowDidResignKey:))]
    fn window_did_resign_key(&self, _notification: &NSNotification) {
      self.finish(None);
    }
  }

  unsafe impl NSTableViewDataSource for PanelDelegate {
    #[unsafe(method(numberOfRowsInTableView:))]
    fn number_of_rows(&self, _table: &NSTableView) -> NSInteger {
      self.ivars().model.borrow().display.len() as NSInteger
    }
  }

  unsafe impl NSTableViewDelegate for PanelDelegate {
    /// Called only for the lines in (or just outside) view.
    #[unsafe(method_id(tableView:viewForTableColumn:row:))]
    fn view_for_row(
      &self,
      _table: &NSTableView,
      _column: Option<&NSTableColumn>,
      row: NSInteger,
    ) -> Option<Retained<NSView>> {
      self.view_at(row)
    }

    #[unsafe(method(tableView:heightOfRow:))]
    fn height_of_row(&self, _table: &NSTableView, row: NSInteger) -> f64 {
      let model = self.ivars().model.borrow();
      usize::try_from(row)
        .ok()
        .and_then(|row| model.display.get(row))
        .map_or(ROW_HEIGHT, Model::row_height)
    }

    /// Rows draw their own highlight; the table's selection is never used.
    #[unsafe(method(tableView:shouldSelectRow:))]
    fn should_select_row(&self, _table: &NSTableView, _row: NSInteger) -> Bool {
      Bool::NO
    }
  }
);

impl PanelDelegate {
  /// The view for table line `row`: a heading, or a row built from its item.
  fn view_at(&self, row: NSInteger) -> Option<Retained<NSView>> {
    let mtm = self.mtm();
    let model = self.ivars().model.borrow();
    match model.display.get(usize::try_from(row).ok()?)? {
      DisplayRow::Header(name) => Some(header_view(mtm, name)),
      DisplayRow::Item(pos) => {
        let item = &model.items[*model.filtered.get(*pos)?];
        let row = make_row(mtm, item, *pos == model.selected, *pos, self);
        Some(Retained::into_super(row))
      }
    }
  }

  fn new(mtm: MainThreadMarker, model: Model) -> Retained<Self> {
    let this = mtm.alloc::<Self>().set_ivars(DelegateIvars {
      state: RefCell::new(None),
      model: RefCell::new(model),
    });
    unsafe { msg_send![super(this), init] }
  }

  /// Sizes the panel to the current lines. The bottom edge (and the search
  /// field) stays put, so the panel extends upward as more rows match.
  fn fit_panel(&self) {
    let height = self.ivars().model.borrow().panel_height();
    let guard = self.ivars().state.borrow();
    let Some(state) = guard.as_ref() else { return };
    let mut frame = state.panel.frame();
    if (frame.size.height - height).abs() > 0.5 {
      frame.size.height = height;
      state.panel.setFrame_display(frame, true);
      // The shadow follows the content's alpha; recompute it for the new size.
      state.panel.invalidateShadow();
    }
  }

  fn refilter(&self) {
    let query = {
      let guard = self.ivars().state.borrow();
      let Some(state) = guard.as_ref() else { return };
      state.search.stringValue().to_string()
    };
    self.ivars().model.borrow_mut().filter(&query);
    self.fit_panel();

    let guard = self.ivars().state.borrow();
    let Some(state) = guard.as_ref() else { return };
    // Reloads only the lines in view. A new set of rows starts at the top.
    state.table.reloadData();
    state.table.scrollRowToVisible(0);
  }

  fn move_selection(&self, delta: isize) {
    let (next, row) = {
      let model = self.ivars().model.borrow();
      let count = model.filtered.len();
      if count == 0 {
        return;
      }
      let next = (model.selected as isize + delta).rem_euclid(count as isize) as usize;
      (next, model.item_rows[next])
    };
    self.highlight(next);
    // Bring the row into view if it's scrolled out.
    if let Some(state) = self.ivars().state.borrow().as_ref() {
      state.table.scrollRowToVisible(row as NSInteger);
    }
  }

  /// Moves the highlight to `pos`, fading between the two rows. Rows out of
  /// view have no view to update; they pick up the state when they're built.
  fn highlight(&self, pos: usize) {
    let changes = {
      let mut model = self.ivars().model.borrow_mut();
      let previous = model.selected;
      if previous == pos || pos >= model.filtered.len() {
        return;
      }
      model.selected = pos;
      [
        (model.item_rows.get(previous).copied(), false),
        (model.item_rows.get(pos).copied(), true),
      ]
    };
    let guard = self.ivars().state.borrow();
    let Some(state) = guard.as_ref() else { return };
    for (row, selected) in changes {
      let Some(row) = row else { continue };
      if let Some(view) = state.table.viewAtColumn_row_makeIfNecessary(0, row as NSInteger, false) {
        set_row_highlight(&view, selected, true);
      }
    }
  }

  /// Highlights `pos` in place (no rebuild — this runs inside the clicked
  /// row's own `mouseDown:`).
  fn select_visible(&self, pos: usize) {
    self.highlight(pos);
  }

  /// One click highlights, a double click runs the row.
  fn click(&self, pos: usize, click_count: isize) {
    self.select_visible(pos);
    if click_count >= 2 {
      self.choose();
    }
  }

  fn choose(&self) {
    let id = {
      let model = self.ivars().model.borrow();
      model
        .filtered
        .get(model.selected)
        .map(|&i| model.items[i].id.clone())
    };
    if id.is_some() {
      self.finish(id);
    }
  }

  /// Tears the panel down and reports the outcome. Idempotent: closing the
  /// panel resigns key, which re-enters here, and the second call is a no-op.
  fn finish(&self, id: Option<String>) {
    let Some(state) = self.ivars().state.borrow_mut().take() else {
      return;
    };
    state.panel.setDelegate(None);
    state.parent.removeChildWindow(&state.panel);
    state.panel.orderOut(None);
    restore_parent_focus(&state.parent);
    let event = match id {
      Some(id) => PanelEvent {
        kind: "select".into(),
        id: Some(id),
      },
      None => PanelEvent {
        kind: "close".into(),
        id: None,
      },
    };
    state
      .on_event
      .call(event, ThreadsafeFunctionCallMode::NonBlocking);
    CURRENT.with(|c| c.borrow_mut().take());
  }
}

thread_local! {
  /// Keeps the open panel's delegate (and through it, all state) alive. AppKit
  /// holds delegates weakly.
  static CURRENT: RefCell<Option<Retained<PanelDelegate>>> = const { RefCell::new(None) };
}

pub(crate) fn label(mtm: MainThreadMarker, text: &str, size: f64, color: &NSColor) -> Retained<NSTextField> {
  let field = NSTextField::labelWithString(&NSString::from_str(text), mtm);
  field.setFont(Some(&NSFont::systemFontOfSize(size)));
  field.setTextColor(Some(color));
  field.setAlignment(NSTextAlignment::Left);
  field
}

fn row_fill(selected: bool) -> Retained<NSColor> {
  if selected {
    NSColor::whiteColor().colorWithAlphaComponent(0.14)
  } else {
    NSColor::clearColor()
  }
}

/// Sets a row's background, optionally fading from its current colour. The
/// row's own layer never animates implicitly (AppKit owns it), so the fade is
/// an explicit `CABasicAnimation`. Colours go through KVC as `id`, which
/// avoids spelling out `CGColorRef` in the message signatures.
fn set_row_highlight(row: &NSView, selected: bool, animated: bool) {
  // SAFETY: plain Core Animation messaging on a layer-backed view we own.
  unsafe {
    let layer: *mut AnyObject = msg_send![row, layer];
    if layer.is_null() {
      return;
    }
    let key = NSString::from_str("backgroundColor");
    let color = row_fill(selected);
    let to: *mut AnyObject = msg_send![&*color, CGColor];
    if animated {
      let from: *mut AnyObject = msg_send![layer, valueForKey: &*key];
      if let Some(class) = AnyClass::get(c"CABasicAnimation") {
        let animation: Retained<AnyObject> =
          msg_send![class, animationWithKeyPath: &*key];
        let _: () = msg_send![&*animation, setFromValue: from];
        let _: () = msg_send![&*animation, setToValue: to];
        let _: () = msg_send![&*animation, setDuration: HIGHLIGHT_FADE_SECONDS];
        let _: () = msg_send![layer, addAnimation: &*animation, forKey: &*key];
      }
    }
    let _: () = msg_send![layer, setValue: to, forKey: &*key];
  }
}

fn symbol_view(
  mtm: MainThreadMarker,
  symbol: &str,
  tint: &NSColor,
) -> Option<Retained<NSImageView>> {
  let image =
    NSImage::imageWithSystemSymbolName_accessibilityDescription(&NSString::from_str(symbol), None)?;
  let view = NSImageView::imageViewWithImage(&image, mtm);
  view.setContentTintColor(Some(tint));
  Some(view)
}

/// A whole shortcut (`⇧ ⌘ F`) in one small rounded box with a thin border,
/// sized to its label.
pub(crate) fn keycaps(mtm: MainThreadMarker, keys: &str) -> Retained<NSView> {
  let cap = NSView::new(mtm);
  cap.setWantsLayer(true);
  let text = label(mtm, keys, 11.0, &NSColor::secondaryLabelColor());
  text.setTranslatesAutoresizingMaskIntoConstraints(false);
  cap.addSubview(&text);
  for constraint in [
    text.leadingAnchor().constraintEqualToAnchor_constant(&cap.leadingAnchor(), KEYCAP_PAD_X),
    text.trailingAnchor().constraintEqualToAnchor_constant(&cap.trailingAnchor(), -KEYCAP_PAD_X),
    text.topAnchor().constraintEqualToAnchor_constant(&cap.topAnchor(), KEYCAP_PAD_Y),
    text.bottomAnchor().constraintEqualToAnchor_constant(&cap.bottomAnchor(), -KEYCAP_PAD_Y),
    // Single characters (⌘, F) would otherwise be narrower than tall.
    cap.widthAnchor().constraintGreaterThanOrEqualToConstant(KEYCAP_MIN_WIDTH),
  ] {
    constraint.setActive(true);
  }
  text.setAlignment(NSTextAlignment::Center);
  // SAFETY: the layer exists once `wantsLayer` is set; the border colour goes
  // through KVC as `id` (see `set_row_highlight`).
  unsafe {
    let layer: *mut AnyObject = msg_send![&*cap, layer];
    let border = NSColor::whiteColor().colorWithAlphaComponent(KEYCAP_BORDER_ALPHA);
    let border_cg: *mut AnyObject = msg_send![&*border, CGColor];
    let _: () = msg_send![layer, setCornerRadius: 4.0_f64];
    let _: () = msg_send![layer, setBorderWidth: KEYCAP_BORDER_WIDTH];
    let _: () = msg_send![layer, setValue: border_cg, forKey: &*NSString::from_str("borderColor")];
  }
  cap
}

/// A section heading line.
fn header_view(mtm: MainThreadMarker, text: &str) -> Retained<NSView> {
  let view = NSView::new(mtm);
  let heading = label(mtm, text, 11.0, &NSColor::tertiaryLabelColor());
  heading.setTranslatesAutoresizingMaskIntoConstraints(false);
  view.addSubview(&heading);
  heading
    .leadingAnchor()
    .constraintEqualToAnchor_constant(&view.leadingAnchor(), 10.0)
    .setActive(true);
  heading
    .centerYAnchor()
    .constraintEqualToAnchor(&view.centerYAnchor())
    .setActive(true);
  view
}

fn make_row(
  mtm: MainThreadMarker,
  item: &ActionsPanelItem,
  selected: bool,
  pos: usize,
  delegate: &PanelDelegate,
) -> Retained<RowBox> {
  let danger = item.danger.unwrap_or(false);
  let text_color = if danger {
    NSColor::systemRedColor()
  } else {
    NSColor::labelColor()
  };

  let row = NSStackView::new(mtm);
  row.setOrientation(NSUserInterfaceLayoutOrientation::Horizontal);
  row.setDistribution(NSStackViewDistribution::Fill);
  row.setSpacing(10.0);
  row.setEdgeInsets(NSEdgeInsets {
    top: 8.0,
    left: 10.0,
    bottom: 8.0,
    right: 10.0,
  });

  if let Some(icon) = item
    .icon_sf_symbol
    .as_deref()
    .and_then(|symbol| symbol_view(mtm, symbol, &text_color))
  {
    row.addArrangedSubview(&icon);
  }
  row.addArrangedSubview(&label(mtm, &item.title, 14.0, &text_color));

  // The lowest hugging priority in the row, so this view soaks up the slack and
  // keeps the keycaps and accessory icon at the trailing edge.
  let spacer = NSView::new(mtm);
  spacer.setContentHuggingPriority_forOrientation(1.0, NSLayoutConstraintOrientation::Horizontal);
  row.addArrangedSubview(&spacer);

  // Trailing content: keycaps, then the accessory icon.
  if let Some(keys) = item.shortcut.as_ref().filter(|keys| !keys.is_empty()) {
    let caps = keycaps(mtm, &keys.join(" "));
    caps.setContentHuggingPriority_forOrientation(999.0, NSLayoutConstraintOrientation::Horizontal);
    row.addArrangedSubview(&caps);
  }
  if let Some(hint) = item
    .hint
    .as_deref()
    .filter(|hint| !hint.is_empty() && item.shortcut.as_ref().is_none_or(|keys| keys.is_empty()))
  {
    row.addArrangedSubview(&label(mtm, hint, 12.0, &NSColor::secondaryLabelColor()));
  }
  if let Some(icon) = item
    .accessory_sf_symbol
    .as_deref()
    .and_then(|symbol| symbol_view(mtm, symbol, &NSColor::secondaryLabelColor()))
  {
    row.addArrangedSubview(&icon);
  }

  let bg = RowBox::new(mtm, pos, delegate);
  bg.setWantsLayer(true);
  // SAFETY: the layer exists once `wantsLayer` is set.
  unsafe {
    let layer: *mut AnyObject = msg_send![&*bg, layer];
    let _: () = msg_send![layer, setCornerRadius: 8.0_f64];
  }
  set_row_highlight(&bg, selected, false);

  row.setTranslatesAutoresizingMaskIntoConstraints(false);
  bg.addSubview(&row);
  for constraint in [
    row.leadingAnchor().constraintEqualToAnchor(&bg.leadingAnchor()),
    row.trailingAnchor().constraintEqualToAnchor(&bg.trailingAnchor()),
    row.topAnchor().constraintEqualToAnchor(&bg.topAnchor()),
    row.bottomAnchor().constraintEqualToAnchor(&bg.bottomAnchor()),
  ] {
    constraint.setActive(true);
  }

  // `InVisibleRect` keeps the area matched to the row as it is laid out.
  // SAFETY: the owner (this row) outlives the area, which lives on the row.
  let tracking = unsafe {
    NSTrackingArea::initWithRect_options_owner_userInfo(
    mtm.alloc(),
    NSRect::ZERO,
    NSTrackingAreaOptions::MouseMoved
      | NSTrackingAreaOptions::ActiveAlways
      | NSTrackingAreaOptions::InVisibleRect,
    Some(&bg),
    None,
    )
  };
  bg.addTrackingArea(&tracking);
  bg
}


/// The panel's translucent background, and the view the panel's own content
/// goes in. On macOS 26+ this is Liquid Glass (`NSGlassEffectView`, matching the
/// launcher); on older systems it falls back to a HUD-material blur. The glass
/// class is looked up at runtime because `objc2-app-kit` predates it, and
/// because it doesn't exist on the older systems we still support.
fn make_backdrop(mtm: MainThreadMarker, bounds: NSRect) -> (Retained<NSView>, Retained<NSView>) {
  if let Some(class) = AnyClass::get(c"NSGlassEffectView") {
    // SAFETY: `NSGlassEffectView` is an `NSView` subclass; `cornerRadius` and
    // `contentView` are its documented properties.
    unsafe {
      let alloc: Allocated<AnyObject> = msg_send![class, alloc];
      let glass: Retained<AnyObject> = msg_send![alloc, initWithFrame: bounds];
      let glass: Retained<NSView> = Retained::cast_unchecked(glass);
      let content = NSView::initWithFrame(mtm.alloc(), bounds);
      let _: () = msg_send![&*glass, setCornerRadius: PANEL_CORNER_RADIUS];
      let _: () = msg_send![&*glass, setContentView: &*content];
      return (glass, content);
    }
  }

  let effect = NSVisualEffectView::initWithFrame(mtm.alloc(), bounds);
  effect.setMaterial(NSVisualEffectMaterial::HUDWindow);
  effect.setBlendingMode(NSVisualEffectBlendingMode::BehindWindow);
  effect.setState(NSVisualEffectState::Active);
  effect.setWantsLayer(true);
  // Untyped so we don't need the QuartzCore bindings just to round corners.
  unsafe {
    let layer: *mut AnyObject = msg_send![&*effect, layer];
    let _: () = msg_send![layer, setCornerRadius: PANEL_CORNER_RADIUS];
    let _: () = msg_send![layer, setMasksToBounds: true];
  }
  let effect: Retained<NSView> = Retained::into_super(effect);
  (effect.clone(), effect)
}

/// Hands keyboard focus back to the launcher once the panel closes — but only
/// while the launcher is still on screen and our app is still the active one.
/// A panel also closes because the user clicked into another app, or because the
/// launcher itself is being hidden; fronting the launcher then would steal focus
/// back from that app, or un-hide the launcher.
pub(crate) fn restore_parent_focus(parent: &NSWindow) {
  let Some(mtm) = MainThreadMarker::new() else {
    return;
  };
  if parent.isVisible() && NSApplication::sharedApplication(mtm).isActive() {
    parent.makeKeyAndOrderFront(None);
  }
}

/// The window behind Electron's `BrowserWindow.getNativeWindowHandle()` (an
/// `NSView*`).
pub(crate) fn parent_window(parent_view: &Buffer) -> Result<Retained<NSWindow>> {
  if parent_view.len() < std::mem::size_of::<usize>() {
    return Err(Error::new(Status::InvalidArg, "parentView is not an NSView pointer"));
  }
  let mut raw = [0u8; std::mem::size_of::<usize>()];
  raw.copy_from_slice(&parent_view[..std::mem::size_of::<usize>()]);
  let view_ptr = usize::from_ne_bytes(raw) as *mut NSView;
  // SAFETY: Electron hands out a live NSView*; we retain it for the duration.
  unsafe { Retained::retain(view_ptr) }
    .and_then(|view| view.window())
    .ok_or_else(|| Error::new(Status::InvalidArg, "parentView has no window"))
}

/// A glass panel `height` tall, anchored to the bottom-right of `parent`, and
/// the view its content goes in. Not shown yet: the caller fills it in, then
/// attaches it with `attach_panel`.
pub(crate) fn make_panel(
  mtm: MainThreadMarker,
  parent: &NSWindow,
  height: f64,
) -> (Retained<ActionsPanel>, Retained<NSView>) {
  let parent_frame = parent.frame();
  let frame = NSRect::new(
    NSPoint::new(
      parent_frame.origin.x + parent_frame.size.width - PANEL_WIDTH - 8.0,
      parent_frame.origin.y + 8.0,
    ),
    NSSize::new(PANEL_WIDTH, height),
  );

  let panel: Retained<ActionsPanel> = {
    let this = mtm.alloc::<ActionsPanel>().set_ivars(());
    unsafe {
      msg_send![
        super(this),
        initWithContentRect: frame,
        styleMask: NSWindowStyleMask::Borderless | NSWindowStyleMask::NonactivatingPanel,
        backing: NSBackingStoreType::Buffered,
        defer: false
      ]
    }
  };
  panel.setOpaque(false);
  panel.setBackgroundColor(Some(&NSColor::clearColor()));
  panel.setAcceptsMouseMovedEvents(true);
  // The launcher is always-on-top; a child at a lower window level would be
  // ordered behind it, so sit just above whatever level the parent is at.
  panel.setLevel(parent.level() + 1);
  // SAFETY: we own the panel through `Retained`; AppKit must not also free it.
  unsafe { panel.setReleasedWhenClosed(false) };
  panel.setCollectionBehavior(
    NSWindowCollectionBehavior::CanJoinAllSpaces | NSWindowCollectionBehavior::FullScreenAuxiliary,
  );

  let bounds = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(PANEL_WIDTH, height));
  let (backdrop, content) = make_backdrop(mtm, bounds);
  panel.setContentView(Some(&backdrop));
  // Liquid Glass draws its own edge and depth; the window shadow would trace
  // the square window frame instead and show as a dark line at the corners.
  panel.setHasShadow(AnyClass::get(c"NSGlassEffectView").is_none());
  (panel, content)
}

/// Shows `panel` as a child of `parent` with keyboard focus on `focus`.
pub(crate) fn attach_panel(parent: &NSWindow, panel: &ActionsPanel, focus: &NSView) {
  // SAFETY: both windows are live; the child is detached again on dismissal.
  unsafe { parent.addChildWindow_ordered(panel, NSWindowOrderingMode::Above) };
  panel.makeKeyAndOrderFront(None);
  panel.makeFirstResponder(Some(focus));
  // The glass/blur backdrop has rounded corners; without this the window keeps
  // a square shadow computed before it drew.
  panel.invalidateShadow();
}

/// Shows the panel anchored to the bottom-right of `parent_view`'s window.
///
/// `parent_view` is Electron's `BrowserWindow.getNativeWindowHandle()` (an
/// `NSView*`). `on_event` is called once: with `{ kind: "select", id }` when a
/// row is chosen, or `{ kind: "close" }` when dismissed (Esc, focus loss,
/// `closeActionsPanel`). Any panel already open is dismissed first.
#[napi(ts_args_type = "parentView: Buffer, title: string, items: ActionsPanelItem[], onEvent: (event: PanelEvent) => void")]
pub fn show_actions_panel(
  parent_view: Buffer,
  title: String,
  items: Vec<ActionsPanelItem>,
  on_event: Function<PanelEvent, ()>,
) -> Result<()> {
  let mtm = MainThreadMarker::new()
    .ok_or_else(|| Error::new(Status::GenericFailure, "not on the AppKit main thread"))?;
  let on_event: EventFn = on_event
    .build_threadsafe_function::<PanelEvent>()
    .callee_handled::<false>()
    .build()?;

  let parent = parent_window(&parent_view)?;

  dismiss_current();

  let (panel, content) = make_panel(mtm, &parent, PANEL_HEIGHT);

  // Fixed title on top, scrolling rows below it, search field at the bottom.
  let search_height = 36.0;
  let title_label = label(mtm, &title, 12.0, &NSColor::secondaryLabelColor());
  title_label.setFrame(NSRect::new(
    NSPoint::new(10.0, PANEL_HEIGHT - TITLE_AREA_HEIGHT + 12.0),
    NSSize::new(PANEL_WIDTH - 20.0, 16.0),
  ));
  // Flexible bottom margin keeps the title pinned to the top as the panel resizes.
  title_label.setAutoresizingMask(
    objc2_app_kit::NSAutoresizingMaskOptions::ViewWidthSizable
      | objc2_app_kit::NSAutoresizingMaskOptions::ViewMinYMargin,
  );
  content.addSubview(&title_label);

  // The rows sit 8pt in from each side, and `LIST_VERTICAL_INSET` above and below.
  let scroll = NSScrollView::initWithFrame(
    mtm.alloc(),
    NSRect::new(
      NSPoint::new(8.0, SEARCH_AREA_HEIGHT + LIST_VERTICAL_INSET),
      NSSize::new(
        PANEL_WIDTH - 16.0,
        PANEL_HEIGHT - SEARCH_AREA_HEIGHT - TITLE_AREA_HEIGHT - 2.0 * LIST_VERTICAL_INSET,
      ),
    ),
  );
  scroll.setDrawsBackground(false);
  scroll.setBorderType(NSBorderType::NoBorder);
  scroll.setHasVerticalScroller(true);
  scroll.setHasHorizontalScroller(false);
  scroll.setAutohidesScrollers(true);
  scroll.setAutoresizingMask(
    objc2_app_kit::NSAutoresizingMaskOptions::ViewWidthSizable
      | objc2_app_kit::NSAutoresizingMaskOptions::ViewHeightSizable,
  );
  scroll.contentView().setDrawsBackground(false);

  let table = NSTableView::initWithFrame(mtm.alloc(), NSRect::ZERO);
  let column = NSTableColumn::initWithIdentifier(mtm.alloc(), &NSString::from_str("row"));
  column.setWidth(PANEL_WIDTH - 16.0);
  column.setResizingMask(NSTableColumnResizingOptions::AutoresizingMask);
  table.addTableColumn(&column);
  table.setColumnAutoresizingStyle(NSTableViewColumnAutoresizingStyle::UniformColumnAutoresizingStyle);
  table.setHeaderView(None);
  table.setBackgroundColor(&NSColor::clearColor());
  table.setStyle(NSTableViewStyle::Plain);
  table.setIntercellSpacing(NSSize::new(0.0, LIST_SPACING));
  table.setSelectionHighlightStyle(NSTableViewSelectionHighlightStyle::None);
  table.setFocusRingType(NSFocusRingType::None);
  // The search field keeps keyboard focus; the table never takes it.
  table.setRefusesFirstResponder(true);
  scroll.setDocumentView(Some(&table));
  content.addSubview(&scroll);

  let search = NSSearchField::initWithFrame(
    mtm.alloc(),
    NSRect::new(
      NSPoint::new(10.0, 8.0),
      NSSize::new(PANEL_WIDTH - 20.0, search_height - 8.0),
    ),
  );
  search.setFocusRingType(NSFocusRingType::None);
  search.setPlaceholderString(Some(&NSString::from_str("Search for actions...")));
  search.setAutoresizingMask(objc2_app_kit::NSAutoresizingMaskOptions::ViewWidthSizable);
  content.addSubview(&search);

  let delegate = PanelDelegate::new(mtm, Model::new(items));
  // SAFETY: the delegate is kept alive by `CURRENT` until `finish`.
  unsafe {
    search.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
    table.setDataSource(Some(ProtocolObject::from_ref(&*delegate)));
    table.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
  }
  panel.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));

  *delegate.ivars().state.borrow_mut() = Some(State {
    panel: panel.clone(),
    parent: parent.clone(),
    search: search.clone(),
    table,
    on_event,
  });
  delegate.fit_panel();
  CURRENT.with(|c| *c.borrow_mut() = Some(delegate));

  attach_panel(&parent, &panel, &search);
  Ok(())
}

/// Dismisses the panel if one is open (reports `{ kind: "close" }`).
#[napi]
pub fn close_actions_panel() {
  dismiss_current();
}

/// Dismisses whichever panel (list or form) is open.
pub(crate) fn dismiss_current() {
  let current = CURRENT.with(|c| c.borrow().clone());
  if let Some(delegate) = current {
    delegate.finish(None);
  }
  crate::actions_form::dismiss_form();
}
