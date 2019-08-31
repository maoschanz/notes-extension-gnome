// notes@maestroschan.fr/menus.js
// GPL v3
// Copyright Romain F. T.

const { Clutter, St } = imports.gi;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const ShellEntry = imports.ui.shellEntry;
const Signals = imports.signals;
const Util = imports.misc.util;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Extension = Me.imports.extension;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

class OptionsMenu {
	constructor (source) {
		this.super_menu = new PopupMenu.PopupMenu(source.actor, 0.2, St.Side.LEFT);

		// We want to keep the item hovered while the menu is up
		this.super_menu.blockSourceEvents = true;
		this._source = source;
		this.super_menu.actor.add_style_class_name('app-well-menu');

		// Chain our visibility and lifecycle to that of the source
		source.actor.connect('notify::mapped', () => {
			if (!source.actor.mapped) {
				this.super_menu.close();
			}
		});
		source.actor.connect('destroy', this.super_menu.destroy.bind(this.super_menu));

		Main.uiGroup.add_actor(this.super_menu.actor);
	}

	_redisplay () {
		this.super_menu.removeAll(); //-----------------------------------------
		
		this.size_item = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: false,
			hover: false,
			style_class: null,
			can_focus: false
		});
		this.super_menu.addMenuItem(this.size_item);
		this._buildSizeItem();
		
		this._appendSeparator(); //---------------------------------------------
		
		this.color1_item = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: false,
			hover: false,
			style_class: null,
			can_focus: false
		});
		this._addColorButton('red', 1);
		this._addColorButton('green', 1);
		this._addColorButton('blue', 1);
		this._addColorButton('black', 1);
		this.super_menu.addMenuItem(this.color1_item);
		
		this.color2_item = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: false,
			hover: false,
			style_class: null,
			can_focus: false
		});
		this._addColorButton('cyan', 2);
		this._addColorButton('magenta', 2);
		this._addColorButton('yellow', 2);
		this._addColorButton('white', 2);
		this.super_menu.addMenuItem(this.color2_item);
		
		let colorSubmenuItem = new PopupMenu.PopupSubMenuMenuItem(_("Custom color"));
		this.super_menu.addMenuItem(colorSubmenuItem);
		this._buildCustomColorMenu(colorSubmenuItem.menu);
		
		this._appendSeparator(); //---------------------------------------------
		
		this.super_menu.addAction(_("Settings"), this._onSettings);
	}

	_buildCustomColorMenu (colorSubmenu) {
		let colorR_item = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: false,
			hover: false,
			style_class: null,
			can_focus: false
		});
		let colorG_item = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: false,
			hover: false,
			style_class: null,
			can_focus: false
		});
		let colorB_item = new PopupMenu.PopupBaseMenuItem({
			reactive: false,
			activate: false,
			hover: false,
			style_class: null,
			can_focus: false
		});
		
		this.colorEntryR = new St.Entry({
			can_focus: true,
			track_hover: true,
			x_expand: true
		});
		this.colorEntryG = new St.Entry({
			can_focus: true,
			track_hover: true,
			x_expand: true
		});
		this.colorEntryB = new St.Entry({
			can_focus: true,
			track_hover: true,
			x_expand: true
		});
		
		let rgb = this._source._note.customColor;
		this.colorEntryR.set_text(rgb.split(',')[0]);
		this.colorEntryG.set_text(rgb.split(',')[1]);
		this.colorEntryB.set_text(rgb.split(',')[2]);
		this.colorEntryR.style = 'background-color: #BB3322; color: #FFFFFF';
		this.colorEntryG.style = 'background-color: #22BB33; color: #FFFFFF';
		this.colorEntryB.style = 'background-color: #2233BB; color: #FFFFFF';
		colorR_item.actor.add(this.colorEntryR, { expand: true });
		colorG_item.actor.add(this.colorEntryG, { expand: true });
		colorB_item.actor.add(this.colorEntryB, { expand: true });
		
		colorSubmenu.addMenuItem(colorR_item);
		colorSubmenu.addMenuItem(colorG_item);
		colorSubmenu.addMenuItem(colorB_item);
		
		let applyMenuItem = new PopupMenu.PopupMenuItem(_("Apply"));
		applyMenuItem.connect('activate', this._onApplyCustom.bind(this));
		colorSubmenu.addMenuItem(applyMenuItem);
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

	_onApplyCustom () {
		let r = Number(this.colorEntryR.get_text());
		let g = Number(this.colorEntryG.get_text());
		let b = Number(this.colorEntryB.get_text());
		this._source._note.applyColor(r, g, b);
	}

	_onSettings () {
		Util.spawn(['gnome-shell-extension-prefs', 'notes@maestroschan.fr']);
		Extension.GLOBAL_BUTTON._hideNotes();
	}

	_onApply (color, button) {
		this._source._note.applyPresetColor(color);
	}

	popup (activatingButton) {
		this._redisplay();
		this.super_menu.toggle();//.open();
	}

	_onBigger () {
		this._source._note.crementFontSize(1);
	}

	_onSmaller () {
		this._source._note.crementFontSize(-1);
	}
};
Signals.addSignalMethods(OptionsMenu.prototype);

//------------------------------------------------------------------------------

var RoundButton = class RoundButton {
	constructor (note, icon, accessibleName) {
		this._note = note;
		this.actor = new St.Button({
			child: new St.Icon({
				icon_name: icon,
				icon_size: 16,
				style_class: 'system-status-icon',
				x_expand: true,
				y_expand: true,
				y_align: Clutter.ActorAlign.CENTER,
			}),
			accessible_name: accessibleName,
			y_align: Clutter.ActorAlign.CENTER,
			style_class: 'calendar-today calendar-day-base',
			reactive: true,
			can_focus: true,
			track_hover: true,
			y_expand: false,
			y_fill: true,
			style: 'margin: 0px;',
		});
	}

	//----------------------- If the button has a menu -------------------------

	addMenu () {
		this._menu = null;
		try {
			// before 3.33, the constructor uses this.actor
			this._menuManager = new PopupMenu.PopupMenuManager(this);
		} catch (e) {
			// after 3.33, the constructor uses directly the parameter
			this._menuManager = new PopupMenu.PopupMenuManager(this.actor);
		}
		this.actor.connect('button-press-event', this.popupMenu.bind(this));
	}

	popupMenu () {
		this.actor.fake_release();
		if (!this._menu) {
			this._menu = new OptionsMenu(this);
			this._menu.super_menu.connect('open-state-changed', (menu, isPoppedUp) => {
				if (!isPoppedUp) {
					this.actor.sync_hover();
				}
			});
			this._menuManager.addMenu(this._menu.super_menu);
		}
		this.emit('menu-state-changed', true);
		this.actor.set_hover(true);
		this._menu.popup();
		this._menuManager.ignoreRelease();
		return false;
	}
};
Signals.addSignalMethods(RoundButton.prototype);

//------------------------------------------------------------------------------

