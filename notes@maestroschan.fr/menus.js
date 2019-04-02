const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const ShellEntry = imports.ui.shellEntry;
const Signals = imports.signals;
const Util = imports.misc.util;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

class OptionsMenu {
	constructor (source) {
		let side = St.Side.LEFT;
		if (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL) {
			side = St.Side.RIGHT;
		}
		this.super_menu = new PopupMenu.PopupMenu(source.actor, 0.2, side);

		// We want to keep the item hovered while the menu is up
		this.blockSourceEvents = true;

		this.super_menu._source = source;
		this.super_menu.actor.add_style_class_name('app-well-menu');

		// Chain our visibility and lifecycle to that of the source
		source.actor.connect('notify::mapped', () => {
			if (!source.actor.mapped) {
				this.super_menu.close();
			}
		});
		source.actor.connect('destroy', this.super_menu.destroy.bind(this));

		Main.uiGroup.add_actor(this.super_menu.actor);
	}

	_redisplay () {
		this.super_menu.removeAll();
		
		this.size_item = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: false,
			hover: false,
			style_class: null,
			can_focus: false
		});

		this.color1_item = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: false,
			hover: false,
			style_class: null,
			can_focus: false
		});
		this.color2_item = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: false,
			hover: false,
			style_class: null,
			can_focus: false
		});
		
		this.super_menu.addMenuItem(this.size_item);
		this._appendSeparator();
		this.super_menu.addMenuItem(this.color1_item);
		this.super_menu.addMenuItem(this.color2_item);
		this._appendMenuItem( _("Custom color") ).connect('activate', this._onCustom.bind(this));
		this._appendSeparator();
		this._appendMenuItem( _("Settings") ).connect('activate', this._onSettings.bind(this));
		
		//----------------------------------------------------------------------
		
		this._addColorButton('red', 1);
		this._addColorButton('green', 1);
		this._addColorButton('blue', 1);
		this._addColorButton('black', 1);
		
		this._addColorButton('cyan', 2);
		this._addColorButton('magenta', 2);
		this._addColorButton('yellow', 2);
		this._addColorButton('white', 2);
		
		this._buildSizeItem();
	}

	_buildSizeItem () {
		let sizeLabel = new St.Label({
			// Have to be a very short string
			text: _("Font size"),
			y_align: Clutter.ActorAlign.CENTER,
		});
		
		let bigger = new St.Button({
			style_class: 'button',
			style: 'margin: 0px; padding-left: 8px; padding-right: 8px;',
			child: new St.Icon({
				icon_name: 'zoom-in-symbolic',
				icon_size: 16,
				style_class: 'system-status-icon',
				x_expand: true,
				y_expand: true,
				y_align: Clutter.ActorAlign.CENTER,
			}),
		});
		let smaller = new St.Button({
			style_class: 'button',
			style: 'margin: 0px; padding-left: 8px; padding-right: 8px;',
			child: new St.Icon({
				icon_name: 'zoom-out-symbolic',
				icon_size: 16,
				style_class: 'system-status-icon',
				x_expand: true,
				y_expand: true,
				y_align: Clutter.ActorAlign.CENTER,
			}),
		});
		
		smaller.connect('clicked', this._onSmaller.bind(this));
		bigger.connect('clicked', this._onBigger.bind(this));
		
		this.size_item.actor.add( sizeLabel, { expand: true, x_fill: true } );
		this.size_item.actor.add( smaller, { expand: true, x_fill: false } );
		this.size_item.actor.add( bigger, { expand: true, x_fill: false } );
	}

	_addColorButton (color, line) {
		let btn = new St.Button({
			style_class: 'calendar-today calendar-day-base',
			style: 'background-color: ' + color + ';',
		});
		if (line == 1) {
			this.color1_item.actor.add( btn );
		} else {
			this.color2_item.actor.add( btn );
		}
		btn.connect('clicked', this._onApply.bind(this, color));
	}

	_appendSeparator () {
		this.super_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	}

	_appendMenuItem (labelText) {
		let item = new PopupMenu.PopupMenuItem(labelText);
		this.super_menu.addMenuItem(item);
		return item;
	}

	_onCustom () {
		this.super_menu._source._note.showColor();
	}

	_onSettings () {
		Util.spawn(["gnome-shell-extension-prefs", "notes@maestroschan.fr"]);
	}

	_onApply (color, button) {
		this.super_menu._source._note.applyPresetColor(color);
	}

	popup (activatingButton) {
		this._redisplay();
		this.super_menu.open();
	}

	_onBigger () {
		this.super_menu._source._note.crementFontSize(1);
	}

	_onSmaller () {
		this.super_menu._source._note.crementFontSize(-1);
	}
};
Signals.addSignalMethods(OptionsMenu.prototype);

//--------------------

var RoundMenuButton = class RoundMenuButton {
	constructor (note, bouton) {
		this._note = note;
		this.actor = bouton;
		this.actor.connect('button-press-event', this._onButtonPress.bind(this));
		this._menu = null;
		this._menuManager = new PopupMenu.PopupMenuManager(this);
	}

	_onMenuPoppedDown () {
		this.actor.sync_hover();
		this.emit('menu-state-changed', false);
	}

	popupMenu () {
		this.actor.fake_release();
		if (!this._menu) {
			this._menu = new OptionsMenu(this);
			this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
				if (!isPoppedUp) {
					this._onMenuPoppedDown();
				}
			});
			this._menuManager.addMenu(this._menu);
		}
		this.emit('menu-state-changed', true);
		this.actor.set_hover(true);
		this._menu.popup();
		this._menuManager.ignoreRelease();
		return false;
	}

	_onButtonPress (actor, event) {
		let button = event.get_button();
		this.popupMenu();
		return Clutter.EVENT_STOP;
	}
};
Signals.addSignalMethods(RoundMenuButton.prototype);

//------------------------------------------------

class NoteMenu {
	constructor (entry, note) {
		this.super_menu = new ShellEntry.EntryMenu(entry);
		this._note = note;
		let item;
		item = new PopupMenu.PopupMenuItem(_("Select All"));
		item.connect('activate', this._onSelectAll.bind(this));
		this.super_menu.addMenuItem(item);
		this._selectAllItem = item;
	}

	open () {
		this.super_menu.open();
	}

	_onSelectAll () {
		this.super_menu._entry.clutter_text.set_selection(0, this.super_menu._entry.clutter_text.length);
	}
};

/* From GNOME Shell code source */
function addContextMenu(entry, note) {
	if (entry.menu)
		return;

	let wrapperClass = new NoteMenu(entry, note);
	entry.menu = wrapperClass.super_menu;
	entry._menuManager = new PopupMenu.PopupMenuManager({ actor: entry });
	entry._menuManager.addMenu(entry.menu);

	// Add an event handler to both the entry and its clutter_text; the former
	// so padding is included in the clickable area, the latter because the
	// event processing of ClutterText prevents event-bubbling.
	entry.clutter_text.connect('button-press-event', (actor, event) => {
		ShellEntry._onButtonPressEvent(actor, event, entry);
	});
	entry.connect('button-press-event', (actor, event) => {
		ShellEntry._onButtonPressEvent(actor, event, entry);
	});

	entry.connect('popup-menu', actor => { ShellEntry._onPopup(actor, entry); });

	entry.connect('destroy', () => {
		entry.menu.destroy();
		entry.menu = null;
		entry._menuManager = null;
	});
}
