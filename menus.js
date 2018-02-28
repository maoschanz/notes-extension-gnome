const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const ShellEntry = imports.ui.shellEntry;
const Signals = imports.signals;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

const ColorMenu = new Lang.Class({
	Name: 'ColorMenu',
	Extends: PopupMenu.PopupMenu,

	_init: function(source) {
		let side = St.Side.LEFT; //FIXME ??
		if (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL)
			side = St.Side.RIGHT;

		this.parent(source.actor, 0.5, side);

		// We want to keep the item hovered while the menu is up
		this.blockSourceEvents = true;

		this._source = source;

		this.actor.add_style_class_name('app-well-menu');

		// Chain our visibility and lifecycle to that of the source
		source.actor.connect('notify::mapped', Lang.bind(this, function () {
			if (!source.actor.mapped)
				this.close();
		}));
		source.actor.connect('destroy', Lang.bind(this, this.destroy));

		Main.uiGroup.add_actor(this.actor);
	},

	_redisplay: function() {
		this.removeAll();

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
		this.addMenuItem(this.color1_item);
		this.addMenuItem(this.color2_item);
		
		let red = new St.Button({
			style_class: 'calendar-today calendar-day-base',
			style: 'background-color: red;',
		});
		let green = new St.Button({
			style_class: 'calendar-today calendar-day-base',
			style: 'background-color: green;',
		});
		let blue = new St.Button({
			style_class: 'calendar-today calendar-day-base',
			style: 'background-color: blue;',
		});
		let black = new St.Button({
			style_class: 'calendar-today calendar-day-base',
			style: 'background-color: black;',
		});
		this.color1_item.actor.add( red );
		this.color1_item.actor.add( green );
		this.color1_item.actor.add( blue );
		this.color1_item.actor.add( black );
		
		red.connect('clicked', Lang.bind(this, this._onApply, 'red'));
		green.connect('clicked', Lang.bind(this, this._onApply, 'green'));
		blue.connect('clicked', Lang.bind(this, this._onApply, 'blue'));
		black.connect('clicked', Lang.bind(this, this._onApply, 'black'));
		
		let cyan = new St.Button({
			style_class: 'calendar-today calendar-day-base',
			style: 'background-color: cyan;',
		});
		let magenta = new St.Button({
			style_class: 'calendar-today calendar-day-base',
			style: 'background-color: magenta;',
		});
		let yellow = new St.Button({
			style_class: 'calendar-today calendar-day-base',
			style: 'background-color: yellow;',
		});
		let white = new St.Button({
			style_class: 'calendar-today calendar-day-base',
			style: 'background-color: white;',
		});
		this.color2_item.actor.add( cyan );
		this.color2_item.actor.add( magenta );
		this.color2_item.actor.add( yellow );
		this.color2_item.actor.add( white );
		
		cyan.connect('clicked', Lang.bind(this, this._onApply, 'cyan'));
		magenta.connect('clicked', Lang.bind(this, this._onApply, 'magenta'));
		yellow.connect('clicked', Lang.bind(this, this._onApply, 'yellow'));
		white.connect('clicked', Lang.bind(this, this._onApply, 'white'));
		
		this._appendSeparator();
		this._appendMenuItem( _("Custom color") ).connect('activate', Lang.bind(this, this._onCustom));
		
	},
	
	_appendSeparator: function () {
		let separator = new PopupMenu.PopupSeparatorMenuItem();
		this.addMenuItem(separator);
	},

	_appendMenuItem: function(labelText) {
		let item = new PopupMenu.PopupMenuItem(labelText);
		this.addMenuItem(item);
		return item;
	},
	
	_onCustom: function() {
		this._source._note.showColor();
	},
	
	_onApply(a, b, c) {
		this._source._note.blackFontColor();
		let temp;
		switch(c) {
			case 'red':
			temp = '255,0,0';
			break;
			case 'magenta':
			temp = '255,0,255';
			break;
			case 'yellow':
			temp = '255,255,0';
			break;
			case 'white':
			temp = '230,230,230';
			break;
			case 'cyan':
			temp = '0,255,255';
			break;
			case 'green':
			temp = '0,255,0';
			break;
			case 'blue':
			temp = '0,0,255'; // valeur anormale pour conservation par delà les redémarrages
			this._source._note.whiteFontColor();
			break;
			case 'black':
			default:
			temp = '10,10,10';
			this._source._note.whiteFontColor();
			break;
		}
		this._source._note.customColor = temp;
		this._source._note.noteEntry.style = this._source._note.noteStyle();
		this._source._note.actor.style = this._source._note.actorStyle();	
	},

	popup: function(activatingButton) {
		this._redisplay();
		this.open();
	},
});
Signals.addSignalMethods(ColorMenu.prototype);

//--------------------

var RoundMenuButton = new Lang.Class({
	Name: 'RoundMenuButton',
	
	_init: function( note, bouton ){
		this._note = note;
		this.actor = bouton;
		
		this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
		
		this._menu = null;
		this._menuManager = new PopupMenu.PopupMenuManager(this);
	},
	
	_onMenuPoppedDown: function() {
		this.actor.sync_hover();
		this.emit('menu-state-changed', false);
	},
	
	popupMenu: function() {
		this.actor.fake_release();

		if (!this._menu) {
			this._menu = new ColorMenu(this);
			this._menu.connect('open-state-changed', Lang.bind(this, function (menu, isPoppedUp) {
				if (!isPoppedUp)
					this._onMenuPoppedDown();
			}));

			this._menuManager.addMenu(this._menu);
		}

		this.emit('menu-state-changed', true);

		this.actor.set_hover(true);
		this._menu.popup();
		this._menuManager.ignoreRelease();

		return false;
	},
	
	_onButtonPress: function(actor, event) {
		let button = event.get_button();
		this.popupMenu();
		return Clutter.EVENT_STOP;
	},
});
Signals.addSignalMethods(RoundMenuButton.prototype);

//------------------------------------------------

const NoteMenu = new Lang.Class({
	Name:		'NoteMenu',
	Extends:	ShellEntry.EntryMenu,
	
	_init: function(entry, note) {
		this.parent(entry);
		
		this._note = note;
		
		let item;
		item = new PopupMenu.PopupMenuItem(_("Select All"));
		item.connect('activate', Lang.bind(this, this._onSelectAll));
		this.addMenuItem(item);
		this._selectAllItem = item;
		
		item = new PopupMenu.PopupSeparatorMenuItem();
		this.addMenuItem(item);
		
		item = new PopupMenu.PopupMenuItem(_("Bigger font"));
		item.connect('activate', Lang.bind(this, this._onBig));
		this.addMenuItem(item);
		this._bigItem = item;
		
		item = new PopupMenu.PopupMenuItem(_("Smaller font"));
		item.connect('activate', Lang.bind(this, this._onSmall));
		this.addMenuItem(item);
		this._smallItem = item;
		
	},
	
	open: function() {
		this.parent();
	},
	
	_onSelectAll: function() {
		this._entry.clutter_text.set_selection(0, this._entry.clutter_text.length);
	},
	
	_onBig: function() {
		this._note._fontSize = this._note._fontSize + 2;
		this._entry.style = this._note.noteStyle();
	},
	
	_onSmall: function() {
		this._note._fontSize = this._note._fontSize - 2;
		this._entry.style = this._note.noteStyle();
	},
	
});

/* From GNOME Shell code source */
function addContextMenu(entry, note) {
	if (entry.menu)
		return;

	entry.menu = new NoteMenu(entry, note);
	entry._menuManager = new PopupMenu.PopupMenuManager({ actor: entry });
	entry._menuManager.addMenu(entry.menu);

	// Add an event handler to both the entry and its clutter_text; the former
	// so padding is included in the clickable area, the latter because the
	// event processing of ClutterText prevents event-bubbling.
	entry.clutter_text.connect('button-press-event', Lang.bind(null, ShellEntry._onButtonPressEvent, entry));
	entry.connect('button-press-event', Lang.bind(null, ShellEntry._onButtonPressEvent, entry));

	entry.connect('popup-menu', Lang.bind(null, ShellEntry._onPopup, entry));

	entry.connect('destroy', function() {
		entry.menu.destroy();
		entry.menu = null;
		entry._menuManager = null;
	});
}
