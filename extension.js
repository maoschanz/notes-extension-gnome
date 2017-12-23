const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const Panel = imports.ui.panel;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const MessageList = imports.ui.messageList;
const Util = imports.misc.util;
const MessageTray = imports.ui.messageTray;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const ShellEntry = imports.ui.shellEntry;
const Meta = imports.gi.Meta;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

// /home/roschan/.local/share/notes@maestroschan.fr
const PATH = GLib.build_pathv('/', [GLib.get_user_data_dir(), 'notes@maestroschan.fr']);
//const BOXSTYLE = 'spacing: 10px; margin: 5px;'

/*

TODO
le notesGroup devrait être limité au simple cas où il sert à quelque chose. (environ fait)
ne pas avoir de notesGroup du tout puisqu'on peut faire sans
du coup restaurer le fonctionnement ancien du changement de visibilité des boîtes ?

*/

//-------------------------------------------------

let allNotes;

function init() {
	Convenience.initTranslations();
	try {
		Util.trySpawnCommandLine("mkdir " + PATH ); //améliorable TODO
	} catch (e) {
		log(e.message);
	}
}

//------------------------------------------------

function saveAllNotes() {
	
	allNotes.forEach(function(n){
		if(n.actor != null) {
			n.saveState();
			n.saveText();
		}
	});
}

function refreshArray() {
	let temp = new Array();
	allNotes.forEach(function(n){
		if (n.actor == null) {
			//rien
		} else {
			let nextId = temp.length;
			n.id = nextId;
			temp.push(n);
		}
	});
	allNotes = null;
	allNotes = temp;
	
	Util.trySpawnCommandLine("rm " + PATH + '/' + allNotes.length.toString() + '_state');
	Util.trySpawnCommandLine("rm " + PATH + '/' + allNotes.length.toString() + '_text');
}

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
		
//		item = new PopupMenu.PopupSeparatorMenuItem();
//		this.addMenuItem(item);
//		
//		item = new PopupMenu.PopupMenuItem(_("Bold"));
//		item.connect('activate', Lang.bind(this, this._onBold));
//		this.addMenuItem(item);
//		this._boldItem = item;
//		
//		item = new PopupMenu.PopupMenuItem(_("Italic"));
//		item.connect('activate', Lang.bind(this, this._onItalic));
//		this.addMenuItem(item);
//		this._italicItem = item;
//		
//		item = new PopupMenu.PopupMenuItem(_("Underlined"));
//		item.connect('activate', Lang.bind(this, this._onUnderlined));
//		this.addMenuItem(item);
//		this._underlinedItem = item;
	},
	
	open: function() {
		this._updateBoldItem();
		this._updateItalicItem();
		this._updateUnderlinedItem();
		this.parent();
	},
	
	_onSelectAll: function() {
		this._entry.clutter_text.set_selection(0, this._entry.clutter_text.length);
	},
	
	_onBold: function() {
		
	},
	
	_onItalic: function() {
		
	},
	
	_onUnderlined: function() {
		
	},
	
	_onBig: function() {
		this._note._fontSize = this._note._fontSize + 2;
		this._entry.style = this._note.noteStyle();
	},
	
	_onSmall: function() {
		this._note._fontSize = this._note._fontSize - 2;
		this._entry.style = this._note.noteStyle();
	},
	
	_updateBoldItem: function() {
		
	},
	
	_updateItalicItem: function() {
		
	},
	
	_updateUnderlinedItem: function() {
		
	},
});

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


//------------------------------------------------

const NoteBox = new Lang.Class({
	Name:		'NoteBox',
	
	_init: function(id) {
		
		this.id = id;
		
		this.build('buttons');
	},
	
	_setNotePosition: function() {
		let monitor = Main.layoutManager.primaryMonitor;
		
		this.actor.set_position(
			monitor.x + Math.floor(this._x),
			monitor.y + Math.floor(this._y)
		);
	},
	
	actorStyle: function() {
		let temp = 'background-color: rgba(' + this.customColor + ', 0.7);';
		if(this._fontColor != '') {
			temp += 'color: ' + this._fontColor + ';';
		}
		temp += 'border-radius: 8px; padding: 0px 7px 7px 7px;';
		
		return temp;
	},
	
	noteStyle: function() {
		let temp = 'background-color: rgba(' + this.customColor + ', 0.8);';
		if(this._fontColor != '') {
			temp += 'color: ' + this._fontColor + ';';
		}
		if(this._fontSize != 0) {
			temp += 'font-size: ' + this._fontSize + 'px;';
		}
		return temp;
	},
	
	_addButton: function(box, icon, accessibleName) {

		let button = new St.Button({
			child: new St.Icon({
				icon_name: icon,
				style_class: 'system-status-icon',
				x_expand: true,
				y_expand: true,
				style: 'margin: 5px;',
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

		box.add(button);

		return button;
	},
	
	_addTextButton: function(box, label) {

		let button = new St.Button({
			child: new St.Label({
				text: _(label),
				x_expand: true,
				y_expand: true,
				y_align: Clutter.ActorAlign.CENTER,
			}),
			accessible_name: label,
			y_align: Clutter.ActorAlign.CENTER,
			style_class: 'button',
			reactive: true,
			can_focus: true,
			track_hover: true,
			y_expand: false,
			y_fill: true
		});
		box.add(button);

		return button;
	},
	
	build: function(visible_box) {
		this.actor = new St.BoxLayout({
			reactive: true,
			vertical: true,
			min_height: 75,
			min_width: 245
		});
		
		this._fontColor = '';
		this._fontSize = SETTINGS.get_int("font-size");
		this.loadState();
		this.actor.style = this.actorStyle();
		
		this.buttons_box = new St.BoxLayout({
			vertical: false,
			visible: false,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'boxstyle',
		});
		
		this._addButton(this.buttons_box,'list-add-symbolic', 'save').connect('clicked', Lang.bind(this, this.createNote));
		this._addButton(this.buttons_box,'user-trash-symbolic', 'delete').connect('clicked', Lang.bind(this, this.showDelete));
		this._addButton(this.buttons_box,'preferences-color-symbolic', 'color').connect('clicked', Lang.bind(this, this.showColor));
		this.buttons_box.add_actor(new St.Label({
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			text: ''
		}));
		this._addButton(this.buttons_box,'view-restore-symbolic', 'size').connect('clicked', Lang.bind(this, this.showControls));
		
		this.color_box = new St.BoxLayout({
			vertical: false,
			visible: false,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'boxstyle',
		});
		
		this.colorEntryR = new St.Entry({
			name: 'colorEntryR',
			can_focus: true,
			hint_text: _('Red'),
			track_hover: true,
			x_expand: true
		});
		this.colorEntryV = new St.Entry({
			name: 'colorEntryV',
			can_focus: true,
			hint_text: _('Green'),
			track_hover: true,
			x_expand: true
		});
		this.colorEntryB = new St.Entry({
			name: 'colorEntryB',
			can_focus: true,
			hint_text: _('Blue'),
			track_hover: true,
			x_expand: true
		});
		this.colorEntryR.set_text(this.customColor.split(',')[0]);
		this.colorEntryV.set_text(this.customColor.split(',')[1]);
		this.colorEntryB.set_text(this.customColor.split(',')[2]);
		this.colorEntryR.style = 'background-color: #BB3322; color: #FFFFFF';
		this.colorEntryV.style = 'background-color: #22BB33; color: #FFFFFF';
		this.colorEntryB.style = 'background-color: #2233BB; color: #FFFFFF';
		
		this._addButton(this.color_box, 'go-previous-symbolic', 'back').connect('clicked', Lang.bind(this, this.hideColor));

		this.color_box.add_actor(this.colorEntryR);
		this.color_box.add_actor(this.colorEntryV);
		this.color_box.add_actor(this.colorEntryB);
		this._addButton(this.color_box, 'object-select-symbolic', 'ok').connect('clicked', Lang.bind(this, this.applyColor));
		
		this.delete_box = new St.BoxLayout({
			vertical: false,
			visible: false,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'boxstyle',
		});
		
		this._addButton(this.delete_box, 'go-previous-symbolic', 'back').connect('clicked', Lang.bind(this, this.hideDelete));
		this.delete_box.add_actor(new St.Label({
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			text: _("Delete this note ?")
		}));
		this._addButton(this.delete_box, 'user-trash-symbolic', 'ok').connect('clicked', Lang.bind(this, this.deleteNote));
		
		this.controls_box = new St.BoxLayout({
			vertical: false,
			visible: false,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'boxstyle',
		});
		
		this._addButton(this.controls_box,'go-previous-symbolic', 'back').connect('clicked', Lang.bind(this, this.hideControls));
		this.controls_box.add_actor(new St.Label({
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			text: ''
		}));
		this._addTextButton(this.controls_box, _('Move')).connect('clicked', Lang.bind(this, this.moveNote));
		this._addTextButton(this.controls_box, _('Resize')).connect('clicked', Lang.bind(this, this.resize));
		
		//-------------
		
		this.actor.add_actor(this.buttons_box);
		this.actor.add_actor(this.controls_box);
		this.actor.add_actor(this.delete_box);
		this.actor.add_actor(this.color_box);
		
		//-------------
		
		this._scrollView = new St.ScrollView({
	//		style_class: 'vfade',
			overlay_scrollbars: true, //si true la barre de défilment est dans l'entrée, sinon elle est à coté
			x_expand: true,
			y_expand: true,
			x_fill: true,
			y_fill: true
		});
   //	 this._scrollView.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC); //TODO ?
		
		this.actor.add_actor(this._scrollView);
		
		this.noteEntry = new St.Entry({
			name: 'noteEntry',
			can_focus: true,
			hint_text: _('Type here...'),
			track_hover: true,
		//?//	reactive: true,
			x_expand: true,
			//y_expand: true,
		});
		let clutterText = this.noteEntry.get_clutter_text();
		clutterText.set_single_line_mode(false);
		clutterText.set_activatable(false);
		clutterText.set_line_wrap(true);
		clutterText.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);
		//clutterText.set_font_name("Cantarell Bold");
		
		this.noteEntry.style = this.noteStyle();
		this.applyColor();
		
		this.entry_box = new St.BoxLayout({
			reactive: true,
			x_expand: true,
			y_expand: true
		});
		
		this.entry_box.add_actor(this.noteEntry);
		
		this._scrollView.add_actor(this.entry_box);
		
		//------------
		
		if(Zposition == 'above-all') {
			Main.layoutManager.addChrome(this.actor);
		} else {
			Main.layoutManager._backgroundGroup.add_actor(this.actor);
//			Main.layoutManager.notesGroup.add_actor(this.actor);
		}
		
		this._setNotePosition();
		
		this.loadText();
		
	//	clutterText.set_use_markup(true);
		
		addContextMenu(this.noteEntry, this);
		
		
		switch(visible_box) {
			case 'color':
				this.color_box.visible = true;			
				break;
			case 'controls':
				this.controls_box.visible = true;
				break;
			case 'delete':
				this.delete_box.visible = true;
				break;
			default:
				this.buttons_box.visible = true;
				break;
		}
	},	
	
	fuckingReloadThisWholeShit: function(visible_box) {
		this.saveState();
		this.saveText();
		
		if(SETTINGS.get_string('layout-position') == 'above-all') {
			Main.layoutManager.removeChrome(this.actor);
		}		
		
		this.destroy();	
	
		this.build(visible_box);	
	},
	
	showControls: function() {
		this.fuckingReloadThisWholeShit('controls');
	},
	
	hideControls: function() {
		this.fuckingReloadThisWholeShit('buttons');
	},
	
	showDelete: function() {
		this.fuckingReloadThisWholeShit('delete');
	},
	
	hideDelete: function() {
		this.fuckingReloadThisWholeShit('buttons');
	},
	
	showColor: function() {
		this.fuckingReloadThisWholeShit('color');
	},
	
	hideColor: function() {
		this.fuckingReloadThisWholeShit('buttons');
	},
	
	blackFontColor: function() {
		this._fontColor = '#000000';
		this.actor.style = this.actorStyle();
		this.noteEntry.style = this.noteStyle();
	},
	
	whiteFontColor: function() {
		this._fontColor = '#ffffff';
		this.actor.style = this.actorStyle();
		this.noteEntry.style = this.noteStyle();
	},
	
	applyColor: function() {
		let temp = '';
		let total = 0;
		if(Number(this.colorEntryR.get_text()) < 0){
			temp += '0, ';
			total += 0;
			this.colorEntryR.set_text('0');
		} else if(Number(this.colorEntryR.get_text()) > 255){
			temp += '255, ';
			total += 255;
			this.colorEntryR.set_text('255');
		} else {
			temp += Number(this.colorEntryR.get_text()).toString() + ', ';
			total += Number(this.colorEntryR.get_text());
		}
		if(Number(this.colorEntryV.get_text()) < 0){
			temp += '0, ';
			total += 0;
			this.colorEntryV.set_text('0');
		} else if(Number(this.colorEntryV.get_text()) > 255){
			temp += '255, ';
			total += 255;
			this.colorEntryV.set_text('255');
		} else {
			temp += Number(this.colorEntryV.get_text()).toString() + ', ';
			total += Number(this.colorEntryV.get_text());
		}
		if(Number(this.colorEntryB.get_text()) < 0){
			temp += '0';
			total += 0;
			this.colorEntryB.set_text('0');
		} else if(Number(this.colorEntryB.get_text()) > 255){
			temp += '255';
			total += 255;
			this.colorEntryR.set_text('255');
		} else {
			temp += Number(this.colorEntryB.get_text()).toString();
			total += Number(this.colorEntryB.get_text());
		}
		this.customColor = temp;
		if (total > 250) {
			this.blackFontColor();
		} else {
			this.whiteFontColor();
		}
		this.noteEntry.style = this.noteStyle();
		this.actor.style = this.actorStyle();
	},
	
	moveNote: function() {
		let timeoutid = Mainloop.timeout_add(1000, Lang.bind(this, function() {	
			let [xMouse, yMouse, mask] = global.get_pointer();
			
			this._x = xMouse;
			this._y = yMouse;
			this._setNotePosition();
			
			Mainloop.source_remove(timeoutid);
		}));
	},
	
	resize: function() {
		let timeoutid = Mainloop.timeout_add(1000, Lang.bind(this, function() {	
			let [xMouse, yMouse, mask] = global.get_pointer();
			
			let newWidth = xMouse - this._x;
			let newHeight = yMouse - this._y;
			
			if (newWidth < 280) {
				newWidth = 280;
			}
			
			if (newHeight < 90) {
				newHeight = 90;
			}
			
			this.actor.width = newWidth;
			this.actor.height = newHeight;
			
			Mainloop.source_remove(timeoutid);
		}));
	},
	
	loadText: function() {
	
		let file2 = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_text']);
		if (!GLib.file_test(file2, GLib.FileTest.EXISTS)) {
			GLib.file_set_contents(file2, '');
		}
	
		let file = Gio.file_new_for_path(PATH + '/' + this.id.toString() + '_text');
		let [result, contents] = file.load_contents(null);
		if (!result) {
			log('Could not read file: ' + PATH);
		}
		let content = contents.toString();
		
		this.noteEntry.set_text(content);
	},
	
	saveText: function() {
		let noteText = this.noteEntry.get_text();
		if (noteText == null) {
			noteText = '';
		}
		let file = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_text']);
		GLib.file_set_contents(file, noteText);
	},
	
	loadState: function() {
	
		let file2 = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_state']);
		if (!GLib.file_test(file2, GLib.FileTest.EXISTS)) {
			let colorStr = SETTINGS.get_string('default-color').split('(')[1].split(')')[0];
			GLib.file_set_contents(
				file2,
				SETTINGS.get_int('default-x').toString() + ';' + SETTINGS.get_int('default-y').toString() + ';' + colorStr + ';' + SETTINGS.get_int('default-width').toString() + ';' + SETTINGS.get_int('default-height').toString() + ';' + SETTINGS.get_int('font-size').toString() + ';'
			);
		}
	
		let file = Gio.file_new_for_path(PATH + '/' + this.id.toString() + '_state');
		let [result, contents] = file.load_contents(null);
		if (!result) {
			log('Could not read file: ' + PATH);
		}
		let content = contents.toString();
		
		let state = content.split(';');
		this._x = Number(state[0]);
		this._y = Number(state[1]);
		this.customColor = state[2];
		this.actor.width = Number(state[3]);
		this.actor.height = Number(state[4]);
		this._fontSize = Number(state[5]);
	},
	
	saveState: function() {
		let noteState = '';
		
		noteState += this._x.toString() + ';';
		noteState += this._y.toString() + ';';
		noteState += this.customColor.toString() + ';'; //ts?
		noteState += this.actor.width.toString() + ';';
		noteState += this.actor.height.toString() + ';';
		noteState += this._fontSize.toString() + ';'; //;?	
		
		//log('saveState | ' + this.id.toString() + ' | '  + noteState);
		let file = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_state']);
		GLib.file_set_contents(file, noteState);
	},
	
	createNote: function() {
		let nextId = allNotes.length;
		allNotes.push(new NoteBox(nextId));
	},
	
	deleteNote: function() {
		this.destroy();
		refreshArray();
		saveAllNotes();
	},
	
	destroy: function() {
		this.actor.destroy_all_children();
		this.actor.destroy();
		this.actor = null;
	},
	
	show: function() {
		this.actor.visible = true;
		if(SETTINGS.get_string('layout-position') == 'above-all') {
			Main.layoutManager.trackChrome(this.actor);
		}
	},
	
	hide: function() {
		this.actor.visible = false;
		if(SETTINGS.get_string('layout-position') == 'above-all') {
			Main.layoutManager.untrackChrome(this.actor);
		}
		this.saveState();
		this.saveText();
	},
	
});

//------------------------------------------------

const NotesMenu = new Lang.Class({
	Name:		'NotesMenu',		// Class Name
	Extends:	PanelMenu.Button,	// Parent Class

	_init: function() {
		this.parent(0.0, 'NotesMenu');
		let box = new St.BoxLayout();
		let icon = new St.Icon({ icon_name: 'document-edit-symbolic', style_class: 'system-status-icon'});

		let toplabel = new St.Label({
			y_align: Clutter.ActorAlign.CENTER
		});

		box.add(icon);
		box.add(toplabel);
		this.actor.add_child(box);
		
		this._isVisible = false;			
		
		this.loadAllNotes();		
		
		this.actor.connect('button-press-event', Lang.bind(this, this.toggleState));
		
		if(Convenience.getSettings().get_boolean('use-shortcut')) {
			this.USE_SHORTCUT = true;
			this._bindShortcut();
		} else {
			this.USE_SHORTCUT = false;
		}
	},
	
	toggleState: function() {
		log('toggleState');
		if(allNotes.length == 0) {
			this._createNote();
			this._showNotes();
		} else if (this._isVisible) {
			this._hideNotes();
		} else {
			this._showNotes();
		}
	},
	
	loadAllNotes: function() {
		let i = 0;
		let ended = false;
		while(!ended) {
			let file2 = GLib.build_filenamev([PATH, '/' + i.toString() + '_state']);
			if (GLib.file_test(file2, GLib.FileTest.EXISTS)) {
				this._createNote();
			} else {
				ended = true;
			}
			i++;
		}
		this._hideNotes();
	},
	
	_createNote: function() {
		let nextId = allNotes.length;
		allNotes.push(new NoteBox(nextId));
	},
	
	_showNotes: function() {
		this._isVisible = true;
		
		allNotes.forEach(function(n){
			n.show();
		});
	},
	
	_hideNotes: function() {
		allNotes.forEach(function(n){
			n.hide();
		});
		
		this._isVisible = false;
	},
	
	_bindShortcut: function() {
		var ModeType = Shell.hasOwnProperty('ActionMode') ?
			Shell.ActionMode : Shell.KeyBindingMode;

		Main.wm.addKeybinding(
			'keyboard-shortcut',
			SettingsSchema,
			Meta.KeyBindingFlags.NONE,
			ModeType.ALL,
			Lang.bind(this, this.toggleState)
		);
	},
});

//------------------------------------------------

const SCHEMA_NAME = 'org.gnome.shell.extensions.notes-extension';

const getSchema = function () {
	let schemaDir = Me.dir.get_child('schemas').get_path();
	let schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir, Gio.SettingsSchemaSource.get_default(), false);
	let schema = schemaSource.lookup(SCHEMA_NAME, false);

	return new Gio.Settings({ settings_schema: schema });
}

var SettingsSchema = getSchema();

//------------------------------------------------

let globalButton;
let SETTINGS;
let ZPosition;
function enable() {
	SETTINGS = Convenience.getSettings();
	Zposition = SETTINGS.get_string('layout-position');
	
	allNotes = new Array();
	
	globalButton = new NotesMenu();
//	about addToStatusArea :
//	- 0 is the position
//	- `right` is the box where we want our globalButton to be displayed (left/center/right)
	Main.panel.addToStatusArea('NotesMenu', globalButton, 0, 'right');
}


function disable() {
	allNotes.forEach(function(n){
		n.saveText();
		n.saveState();
		n.destroy();
	});
	
	if(globalButton.USE_SHORTCUT) {
		Main.wm.removeKeybinding('keyboard-shortcut');
	}
	
	globalButton.destroy();
}




