
const St = imports.gi.St;
const Shell = imports.gi.Shell;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
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

let GLOBAL_BUTTON;
let GLOBAL_ARE_VISIBLE;
let SETTINGS;
var Z_POSITION;

let SIGNAL_LAYOUT;
let SIGNAL_BRING_BACK;
let SIGNAL_ICON;

//-------------------------------------------------

let ALL_NOTES;

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

//------------------------------------------------

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
	
	let textfile = Gio.file_new_for_path(PATH + '/' + ALL_NOTES.length.toString() + '_text');
	let statefile = Gio.file_new_for_path(PATH + '/' + ALL_NOTES.length.toString() + '_state');
	textfile.delete(null);
	statefile.delete(null);
}

//------------------------------------------------

/*
 * This is the button in the top bar. It will trigger the showing/hiding of
 * notes, and if no note exists, it will create the first one.
 * The button can be hidden by some user settings, but still needs to be built
 * because it manages the loading.
 */
class NotesButton {
	constructor () {
		this.super_btn = new PanelMenu.Button(0.0, _("Show notes"), false);
		let box = new St.BoxLayout();
		let icon = new St.Icon({ icon_name: 'document-edit-symbolic', style_class: 'system-status-icon'});

		box.add(icon);
		this.super_btn.actor.add_child(box);
		this.update_icon_visibility();
		
		GLOBAL_ARE_VISIBLE = false;
	
		this.loadAllNotes();
		
		this.super_btn.actor.connect('button-press-event', this.toggleState.bind(this));
		
		if(Convenience.getSettings().get_boolean('use-shortcut')) {
			this.USE_SHORTCUT = true;
			this._bindShortcut();
		} else {
			this.USE_SHORTCUT = false;
		}
	}

	update_icon_visibility () {
		// XXX ??????????????? unexplained bug
		this.super_btn.actor.visible = !Convenience.getSettings().get_boolean('hide-icon');
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
		let nextId = ALL_NOTES.length;
		ALL_NOTES.push(new NoteBox.NoteBox(nextId, '50,50,50', 16));
	}

	_showNotes () {
		GLOBAL_ARE_VISIBLE = true;
		
		if (Z_POSITION == 'special-layer') {
			Main.layoutManager.notesGroup.show();
		}
		
		ALL_NOTES.forEach(function (n) {
			n.show();
		});
	}

	_hideNotes () {
		if (Z_POSITION == 'special-layer') {
			Main.layoutManager.notesGroup.hide();
		}
		
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

	_bindShortcut () {
		var ModeType = Shell.hasOwnProperty('ActionMode') ?
			Shell.ActionMode : Shell.KeyBindingMode;

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

//-------------------------------------------------------

function bringToPrimaryMonitorOnly() {
	ALL_NOTES.forEach(function (n) {
		if (
			(n._x < 0 || n._x > Main.layoutManager.primaryMonitor.width-20) ||
			(n._y < 0 || n._y > Main.layoutManager.primaryMonitor.height-20)
		) {
			[n._x, n._y] = n.computeRandomPosition();
			n._setNotePosition();
		}
	});
}

function updateVisibility() {
	if (Main.overview.viewSelector._activePage != Main.overview.viewSelector._workspacesPage) {
		GLOBAL_BUTTON._onlyHideNotes();
		return;
	}
	if (global.screen.get_workspace_by_index(global.screen.get_active_workspace_index()).list_windows() == '') {
		GLOBAL_BUTTON._showNotes();
	} else {
		GLOBAL_BUTTON._onlyHideNotes();
	}
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

function hideNotesFromSpecialLayer(group, event) {
	// Don't close notes if the user is just hiding a note content
	if (event.get_button() != 3) {
		GLOBAL_BUTTON._hideNotes();
	}
}

//-------------------------------------------------

function enable() {
	SETTINGS = Convenience.getSettings();
	SIGNAL_LAYOUT = SETTINGS.connect('changed::layout-position', updateLayoutSetting.bind(this));
	ALL_NOTES = new Array();
	
	updateLayoutSetting()
	
	Main.layoutManager.notesGroup = new St.Widget({
		name: 'overviewGroup',
		visible: false,
		reactive: true,
		width: Main.layoutManager.primaryMonitor.width,
		height: Main.layoutManager.primaryMonitor.height,
		style_class: 'notesBackground'
	});
	Main.layoutManager.addChrome(Main.layoutManager.notesGroup);
	Main.layoutManager.notesGroup.connect('button-press-event', hideNotesFromSpecialLayer.bind(this));

	GLOBAL_BUTTON = new NotesButton();
//	about addToStatusArea :
//	- 0 is the position
//	- `right` is the box where we want our GLOBAL_BUTTON to be displayed (left/center/right)
	Main.panel.addToStatusArea('NotesButton', GLOBAL_BUTTON.super_btn, 0, 'right');

	SIGNAL_BRING_BACK = SETTINGS.connect('changed::ugly-hack', bringToPrimaryMonitorOnly.bind(this));
	SIGNAL_ICON = SETTINGS.connect('changed::hide-icon', GLOBAL_BUTTON.update_icon_visibility.bind(this));
}

//--------------------------------

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

