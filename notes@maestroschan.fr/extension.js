// notes@maestroschan.fr/extension.js
// GPL v3
// Copyright Romain F. T.

const { St, Shell, GLib, Gio, Meta } = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const Panel = imports.ui.panel;
const Main = imports.ui.main;

// Retrocompatibility
const ShellVersion = imports.misc.config.PACKAGE_VERSION;
var USE_ACTORS = parseInt(ShellVersion.split('.')[1]) < 33;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const NoteBox = Me.imports.noteBox;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

// ~/.local/share/notes@maestroschan.fr
const PATH = GLib.build_pathv('/', [GLib.get_user_data_dir(), 'notes@maestroschan.fr']);

var NOTES_MANAGER;
let GLOBAL_ARE_VISIBLE;
let SETTINGS;
var Z_POSITION;
var AUTO_FOCUS;

let SIGNALS = {};

//------------------------------------------------------------------------------

var ALL_NOTES;

function init() {
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


/*
 * This is the button in the top bar. It will trigger the showing/hiding of
 * notes, and if no note exists, it will create the first one.
 * The button can be hidden by some user settings, but still needs to be built
 * because it manages the loading.
 */
class NotesManager {
	constructor() {
		this.panel_button = new PanelMenu.Button(0.0, _("Show notes"), false);
		let icon = new St.Icon({
			icon_name: 'document-edit-symbolic',
			style_class: 'system-status-icon'
		});
		if(USE_ACTORS) {
			this.panel_button.actor.add_child(icon);
			this.panel_button.actor.connect('button-press-event', this.toggleState.bind(this));
		} else {
			this.panel_button.add_child(icon);
			this.panel_button.connect('button-press-event', this.toggleState.bind(this));
		}
		this.update_icon_visibility();

		// about addToStatusArea : 0 is the position, `right` is the box where
		// we want the button to be displayed (left/center/right)
		Main.panel.addToStatusArea('NotesButton', this.panel_button, 0, 'right');

		GLOBAL_ARE_VISIBLE = false;
		this.loadAllNotes();
		this._bindShortcut();
	}

	destroy() {
		ALL_NOTES.forEach(function (n) {
			n.onlySave();
			n.destroy();
		});

		if(this.USE_SHORTCUT) {
			Main.wm.removeKeybinding('notes-kb-shortcut');
		}

		this.panel_button.destroy();
	}

	//--------------------------------------------------------------------------

	update_icon_visibility() {
		let now_visible = !Convenience.getSettings().get_boolean('hide-icon');
		if(USE_ACTORS) {
			this.panel_button.actor.visible = now_visible;
		} else {
			this.panel_button.visible = now_visible;
		}
	}

	toggleState() {
		// log('toggleState');
		if(ALL_NOTES.length == 0) {
			this.createNote('', 16);
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
				this.createNote('', 16);
			} else {
				ended = true;
			}
			i++;
		}
		this._onlyHideNotes();
	}

	createNote (colorAsString, fontSize) {
		let nextId = ALL_NOTES.length;
		try {
			ALL_NOTES.push(new NoteBox.NoteBox(nextId, '', 16));
		} catch (e) {
			Main.notify(_("Notes extension error: failed to load a note"));
			log('failed to create note n°' + nextId.toString());
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

	saveAllNotes () {
		ALL_NOTES.forEach(function (n) {
			if(n.actor != null) {
				n.saveState();
				n.saveText();
			}
		});
	}

	refreshArray () {
		let temp = new Array();
		ALL_NOTES.forEach(function (n) {
			if (n.actor == null) {
				// nothing
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

	//--------------------------------------------------------------------------

	updateShortcut () {
		if(this.USE_SHORTCUT) {
			Main.wm.removeKeybinding('notes-kb-shortcut');
		}
		this._bindShortcut();
	}

	_bindShortcut () {
		this.USE_SHORTCUT = Convenience.getSettings().get_boolean('use-shortcut');
		if (!this.USE_SHORTCUT) { return; }

		Main.wm.addKeybinding(
			'notes-kb-shortcut',
			Convenience.getSettings(),
			Meta.KeyBindingFlags.NONE,
			Shell.ActionMode.ALL,
			this.toggleState.bind(this)
		);
	}
};

//------------------------------------------------------------------------------

// XXX not very O.-O. P.
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
	ALL_NOTES = new Array();

	updateLayoutSetting()

	NOTES_MANAGER = new NotesManager();

	SIGNALS['layout'] = SETTINGS.connect(
		'changed::layout-position',
		updateLayoutSetting.bind(this)
	);
	SIGNALS['bring-back'] = SETTINGS.connect(
		'changed::ugly-hack',
		bringToPrimaryMonitorOnly.bind(this)
	);
	SIGNALS['hide-icon'] = SETTINGS.connect(
		'changed::hide-icon',
		NOTES_MANAGER.update_icon_visibility.bind(NOTES_MANAGER)
	);
	SIGNALS['kb-shortcut-1'] = SETTINGS.connect(
		'changed::use-shortcut',
		NOTES_MANAGER.updateShortcut.bind(NOTES_MANAGER)
	);
	SIGNALS['kb-shortcut-2'] = SETTINGS.connect(
		'changed::notes-kb-shortcut',
		NOTES_MANAGER.updateShortcut.bind(NOTES_MANAGER)
	);
	SIGNALS['auto-focus'] = SETTINGS.connect(
		'changed::auto-focus',
		() => { Main.notify( // TODO not very user-friendly
			_("Notes"),
			_("Restart the extension to apply the changes")
		); }
	);
}

function disable() {
	SETTINGS.disconnect(SIGNALS['layout']);
	SETTINGS.disconnect(SIGNALS['bring-back']);
	SETTINGS.disconnect(SIGNALS['hide-icon']);
	SETTINGS.disconnect(SIGNALS['kb-shortcut-1']);
	SETTINGS.disconnect(SIGNALS['kb-shortcut-2']);

	NOTES_MANAGER.destroy();
}

//------------------------------------------------------------------------------

