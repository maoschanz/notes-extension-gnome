// notes@maestroschan.fr/extension.js
// GPL v3
// Copyright Romain F. T.

const { St, Shell, GLib, Gio, Meta } = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const Panel = imports.ui.panel;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const NoteBox = Me.imports.noteBox;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

// ~/.local/share/notes@maestroschan.fr
const PATH = GLib.build_pathv('/', [GLib.get_user_data_dir(), 'notes@maestroschan.fr']);

var GLOBAL_BUTTON;
let GLOBAL_ARE_VISIBLE;
let SETTINGS;
var Z_POSITION;
var AUTO_FOCUS;

let SIGNAL_LAYOUT;
let SIGNAL_BRING_BACK;
let SIGNAL_ICON;

//------------------------------------------------------------------------------

var ALL_NOTES;

function init () {
	Convenience.initTranslations();
	try {
		let a = Gio.file_new_for_path(PATH);
		if (!a.query_exists(null)) {
			a.make_directory(null);
		}
	} catch (e) {
		log(e.message);
	}
	Z_POSITION = '';
}

//------------------------------------------------------------------------------

function saveAllNotes () {
	ALL_NOTES.forEach(function (n) {
		if(n.actor != null) {
			n.saveState();
			n.saveText();
		}
	});
}

function refreshArray () {
	let temp = new Array();
	ALL_NOTES.forEach(function (n) {
		if (n.actor == null) {
			//rien
		} else {
			let nextId = temp.length;
			n.id = nextId;
			temp.push(n);
		}
	});
	ALL_NOTES = null;
	ALL_NOTES = temp;
	
	let theoricallyDeletedFilePath = PATH + '/' + ALL_NOTES.length.toString();
	let textfile = Gio.file_new_for_path(theoricallyDeletedFilePath + '_text');
	let statefile = Gio.file_new_for_path(theoricallyDeletedFilePath + '_state');
	textfile.delete(null); // may not do anything
	statefile.delete(null); // may not do anything
}

//------------------------------------------------------------------------------

/*
 * This is the button in the top bar. It will trigger the showing/hiding of
 * notes, and if no note exists, it will create the first one.
 * The button can be hidden by some user settings, but still needs to be built
 * because it manages the loading.
 */
class NotesButton {
	constructor () {
		this.super_btn = new PanelMenu.Button(0.0, _("Show notes"), false);
		let icon = new St.Icon({
			icon_name: 'document-edit-symbolic',
			style_class: 'system-status-icon'
		});
		try { // TODO conditionnelle sur la version
			this.super_btn.add_child(icon);
			this.super_btn.connect('button-press-event', this.toggleState.bind(this));
		} catch (e) {
			this.super_btn.actor.add_child(icon);
			this.super_btn.actor.connect('button-press-event', this.toggleState.bind(this));
		}
		this.update_icon_visibility();
		
		GLOBAL_ARE_VISIBLE = false;
		this.loadAllNotes();
		this._bindShortcut(Convenience.getSettings().get_boolean('use-shortcut'));
	}

	update_icon_visibility () {
		let now_visible = !Convenience.getSettings().get_boolean('hide-icon');
		try { // TODO conditionnelle sur la version
			this.super_btn.visible = now_visible;
		} catch (e) {
			this.super_btn.actor.visible = now_visible;
		}
	}

	toggleState () {
		//log('toggleState');
		if(ALL_NOTES.length == 0) {
			this._createNote();
			this._showNotes();
		} else if (GLOBAL_ARE_VISIBLE) {
			this._hideNotes();
		} else {
			this._showNotes();
		}
	}

	loadAllNotes () {
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
		this._onlyHideNotes();
	}

	_createNote () {
		try {
			let nextId = ALL_NOTES.length;
			ALL_NOTES.push(new NoteBox.NoteBox(nextId, '50,50,50', 16));
		} catch (e) {
			Main.notify(_("Notes extension: failed to create widgets for a note"));
			log('failed to create note n°' + ALL_NOTES.length.toString());
			log(e);
		}
	}

	_showNotes () {
		GLOBAL_ARE_VISIBLE = true;
		ALL_NOTES.forEach(function (n) {
			n.show();
		});
	}

	_hideNotes () {
		ALL_NOTES.forEach(function (n) {
			n.onlyHide();
		});
		ALL_NOTES.forEach(function (n) {
			n.onlySave();
		});
		GLOBAL_ARE_VISIBLE = false;
	}

	_onlyHideNotes () {
		ALL_NOTES.forEach(function (n) {
			n.onlyHide();
		});
		GLOBAL_ARE_VISIBLE = false;
	}

	_bindShortcut (useShortcut) {
		this.USE_SHORTCUT = useShortcut;
		if (!useShortcut) { return; }
		
		var ModeType = Shell.hasOwnProperty('ActionMode')
			? Shell.ActionMode
			: Shell.KeyBindingMode;
		Main.wm.addKeybinding(
			'keyboard-shortcut',
			Convenience.getSettings(),
			Meta.KeyBindingFlags.NONE,
			ModeType.ALL,
			this.toggleState.bind(this)
		);
	}

	destroy () {
		this.super_btn.destroy();
	}
};

//------------------------------------------------------------------------------

function bringToPrimaryMonitorOnly() {
	ALL_NOTES.forEach(function (n) {
		n.fixState();
	});
}

function updateLayoutSetting() {
	ALL_NOTES.forEach(function (n) {
		n.remove_from_the_right_actor();
	});
	
	Z_POSITION = SETTINGS.get_string('layout-position');
	
	ALL_NOTES.forEach(function (n) {
		n.load_in_the_right_actor();
	});
}

//------------------------------------------------------------------------------

function enable() {
	SETTINGS = Convenience.getSettings();
	AUTO_FOCUS = SETTINGS.get_boolean('auto-focus');
	SIGNAL_LAYOUT = SETTINGS.connect('changed::layout-position', updateLayoutSetting.bind(this));
	ALL_NOTES = new Array();
	
	updateLayoutSetting()
	
	GLOBAL_BUTTON = new NotesButton();
	//	about addToStatusArea :
	//	- 0 is the position
	//	- `right` is the box where we want GLOBAL_BUTTON to be displayed (left/center/right)
	Main.panel.addToStatusArea('NotesButton', GLOBAL_BUTTON.super_btn, 0, 'right');

	SIGNAL_BRING_BACK = SETTINGS.connect('changed::ugly-hack', bringToPrimaryMonitorOnly.bind(this));
	SIGNAL_ICON = SETTINGS.connect(
		'changed::hide-icon',
		GLOBAL_BUTTON.update_icon_visibility.bind(GLOBAL_BUTTON)
	);
}

function disable() {
	ALL_NOTES.forEach(function (n) {
		n.onlySave();
		n.destroy();
	});
	
	if(GLOBAL_BUTTON.USE_SHORTCUT) {
		Main.wm.removeKeybinding('keyboard-shortcut');
	}
	
	SETTINGS.disconnect(SIGNAL_LAYOUT);
	SETTINGS.disconnect(SIGNAL_BRING_BACK);
	SETTINGS.disconnect(SIGNAL_ICON);
	
	GLOBAL_BUTTON.destroy();
}

//------------------------------------------------------------------------------

