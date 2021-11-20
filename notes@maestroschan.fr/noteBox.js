// notes@maestroschan.fr/noteBox.js
// GPL v3
// Copyright 2018-2021 Romain F. T.

const { Clutter, St, GLib, Gio } = imports.gi;
const Main = imports.ui.main;
const ShellEntry = imports.ui.shellEntry;
const GrabHelper = imports.ui.grabHelper;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Menus = Me.imports.menus;
const Extension = Me.imports.extension;
const Dialog = Me.imports.dialog;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

// ~/.local/share/notes@maestroschan.fr
const PATH = GLib.build_pathv('/', [GLib.get_user_data_dir(), 'notes@maestroschan.fr']);

const MIN_HEIGHT = 75;
const MIN_WIDTH = 200;

//------------------------------------------------------------------------------

function stringFromArray(data){
	if (data instanceof Uint8Array) {
		return imports.byteArray.toString(data);
	} else {
		return data.toString();
	}
}

/*
 * This class stands for one note. The note's id corresponds to the name of
 * files where its data will be stored. The note's state is loaded and the note
 * is built, then the note's text is loaded.
 * Almost all of the init process is done in the _buildNote() method. Then, the
 * other methods are here for managing note state through buttons, or to
 * interact with the NotesManager singleton.
 */
var NoteBox = class NoteBox {
	constructor (id, color, fontSize) {
		this.id = id;
		this._fontSize = fontSize;
		if (color.split(',').length == 3) {
			this.customColor = color;
		} else {
			let c = Extension.SETTINGS.get_strv('first-note-rgb');
			c[0] = c[0] * 255;
			c[1] = c[1] * 255;
			c[2] = c[2] * 255;
			this.customColor = c.toString();
		}
		this._buildNote();
	}

	_buildNote () {
		this.actor = new St.BoxLayout({
			reactive: true,
			vertical: true,
			min_height: MIN_HEIGHT,
			min_width: MIN_WIDTH,
			style_class: 'noteBoxStyle',
			track_hover: true,
		});

		this._fontColor = '';
		this._loadState();
		this._applyActorStyle();

		// This actually builds all the possible headerbars
		this._buildHeaderbar();

		//----------------------------------------------------------------------

		this._scrollView = new St.ScrollView({
			overlay_scrollbars: true,
			// if true, the scrollbar is inside the textfield, else it's outside
			x_expand: true,
			y_expand: true,
			clip_to_allocation: true,
		});

		this.noteEntry = new St.Entry({
			name: 'noteEntry',
			can_focus: true,
			hint_text: _("Type here…"),
			track_hover: true,
			x_expand: true,
			style_class: 'notesTextField',
		});
		let clutterText = this.noteEntry.get_clutter_text();
		clutterText.set_single_line_mode(false);
		clutterText.set_activatable(false); // we can press Enter
		clutterText.set_line_wrap(true);
		clutterText.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);

		this._entryBox = new St.BoxLayout({
			reactive: true,
			x_expand: true,
			y_expand: true,
			visible: this.entry_is_visible,
		});

		this._entryBox.add_child(this.noteEntry);
		this._scrollView.add_actor(this._entryBox); // yes, actually add_actor
		this.actor.add_child(this._scrollView);

		//----------------------------------------------------------------------

		this._grabHelper = new GrabHelper.GrabHelper(this.noteEntry)
		if (Extension.AUTO_FOCUS) { // TODO dynamically update this setting
			this.noteEntry.connect('enter-event', this._getKeyFocus.bind(this));
			this.noteEntry.connect('leave-event', this._leaveKeyFocus.bind(this));
		} else {
			this.noteEntry.connect('button-press-event', this._getKeyFocus.bind(this));
			this.noteEntry.connect('key-focus-in', this._redraw.bind(this)); // FIXME doesn't work
			this.noteEntry.connect('leave-event', this._leaveKeyFocus.bind(this));
		}
		this.actor.connect('notify::hover', this._applyActorStyle.bind(this));

		//----------------------------------------------------------------------

		// Each note sets its own actor where it should be. This isn't a problem
		// since the related setting isn't directly accessed, but is stored in
		// 'Extension.NOTES_MANAGER' instead, which prevents inconsistencies.
		this.loadIntoCorrectLayer();
		this._setNotePosition();
		this._loadText();
		// ShellEntry.addContextMenu(this.noteEntry); // FIXME doesn't work
		this._initStyle();

		this.grabX = this._x + 100;
		this.grabY = this._y + 10;
	}

	/*
	 * The headerbar contains the UI controls to manage the note:
	 * - The 'new note' button creates a note with the same color and font size,
	 *   but with random coordinates, an empty text, and an harcoded size.
	 * - The 'delete' button asks the user to confirm if they really wants to
	 *   delete the note (see `_addDeleteBox`), and if yes the object is
	 *   destroyed a method from the NotesManager is called to delete the
	 *   corresponding files.
	 * - The 'move' button, which isn't styled as a button but looks like an
	 *   empty space. It simulates a kind of wacky window dragging.
	 * - The 'options' button, showing a menu defined in menus.js
	 * - The 'resize' button, which uses the same dragging mecanism as 'move',
	 *   to resize the note from its upper-right corner.
	 */
	_buildHeaderbar () {
		// This is the regular header, as described above.
		this._buttonsBox = new St.BoxLayout({
			vertical: false,
			visible: true,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'noteHeaderStyle',
		});

		let btnNew = new Menus.NoteRoundButton(
			this,
			'list-add-symbolic',
			_("New")
		);
		btnNew.actor.connect('clicked', this._createNote.bind(this));
		this._buttonsBox.add_child(btnNew.actor);

		let btnDelete = new Menus.NoteRoundButton(
			this,
			'user-trash-symbolic',
			_("Delete")
		);
		btnDelete.actor.connect('clicked', this._openDeleteDialog.bind(this));
		this._buttonsBox.add_child(btnDelete.actor);

		this.moveBox = new St.Button({
			x_expand: true,
			style_class: 'notesTitleButton',
			// label: 'example title'
		});
		this._buttonsBox.add_child(this.moveBox);

		let btnOptions = new Menus.NoteRoundButton(
			this,
			'view-more-symbolic',
			_("Note options")
		);
		btnOptions.addMenu();
		this._buttonsBox.add_child(btnOptions.actor);

		let ctrlButton = new Menus.NoteRoundButton(
			this,
			'view-restore-symbolic',
			_("Resize")
		);
		this._buttonsBox.add_child(ctrlButton.actor);

		this.moveBox.connect('button-press-event', this._onMovePress.bind(this));
		this.moveBox.connect('motion-event', this._onMoveMotion.bind(this));
		this.moveBox.connect('button-release-event', this._onRelease.bind(this));

		ctrlButton.actor.connect('button-press-event', this._onResizePress.bind(this));
		ctrlButton.actor.connect('motion-event', this._onResizeMotion.bind(this));
		ctrlButton.actor.connect('button-release-event', this._onRelease.bind(this));

		this.actor.add_child(this._buttonsBox);
	}

	_openDeleteDialog () {
		let noteText = this.noteEntry.get_text();
		// The text has to be truncated to avoid issues with long notes
		let lines = noteText.split("\n")
		if(lines.length > 10) {
			noteText = lines[0] + "\n" + lines[1] + "\n" + lines[2] + "\n[...]\n";
			noteText += lines[lines.length - 2] + "\n" + lines[lines.length - 1];
		}
		if(noteText === "") {
			noteText = "[" + _("Empty note") + "]";
		}

		let description_label = new St.Label({
			style: 'padding-top: 16px;',
			x_align: Clutter.ActorAlign.CENTER,
			text: noteText,
		});

		let dialog = new Dialog.CustomModalDialog(
			_("Delete this note?"),
			description_label,
			_("Delete"),
			this._deleteNoteObject.bind(this)
		);
		dialog.open();
	}

	openEditTitleDialog () {
		let titleEntry = new St.Entry({
			can_focus: true,
			track_hover: true,
			x_expand: true,
			text: "todo load existing title"
		});

		let dialog = new Dialog.CustomModalDialog(
			_("Edit title"),
			titleEntry,
			_("Apply"),
			this._applyTitleChange.bind(this)
		);
		dialog.open();
	}

	_initStyle () {
		let initialRGB_r = this.customColor.split(',')[0];
		let initialRGB_g = this.customColor.split(',')[1];
		let initialRGB_b = this.customColor.split(',')[2];
		this._applyColor(initialRGB_r, initialRGB_g, initialRGB_b);
		this._applyActorStyle();
		this._applyNoteStyle();
	}

	//--------------------------------------------------------------------------
	// "Public" methods called by NotesManager ---------------------------------

	loadIntoCorrectLayer () {
		if (Extension.NOTES_MANAGER.notesNeedChromeTracking()) {
			Main.layoutManager.addChrome(this.actor, {
				affectsInputRegion: true
			});
		} else {
			Main.layoutManager._backgroundGroup.add_child(this.actor);
		}
	}

	removeFromCorrectLayer () {
		if (Extension.NOTES_MANAGER.notesNeedChromeTracking()) {
//			Main.layoutManager.untrackChrome(this.actor);
			Main.layoutManager.removeChrome(this.actor);
		} else {
			Main.layoutManager._backgroundGroup.remove_actor(this.actor);
		}
	}

	show () {
		this.actor.visible = true;
		if (Extension.NOTES_MANAGER.notesNeedChromeTracking()) {
			Main.layoutManager.trackChrome(this.actor);
		}
	}

	onlyHide () {
		this.actor.visible = false;
		if (Extension.NOTES_MANAGER.notesNeedChromeTracking()) {
			Main.layoutManager.untrackChrome(this.actor);
		}
	}

	onlySave (withMetadata=true) {
		if(withMetadata) {
			this._saveState();
		}
		this._saveText();
	}

	fixState () {
		let outX = (this._x < 0 || this._x > Main.layoutManager.primaryMonitor.width - 20);
		let outY = (this._y < 0 || this._y > Main.layoutManager.primaryMonitor.height - 20);
		if (outX || outY) {
			[this._x, this._y] = this._computeRandomPosition();
			this._setNotePosition();
		}
		if (Number.isNaN(this._x)) { this._x = 10; }
		if (Number.isNaN(this._y)) { this._y = 10; }
		if (Number.isNaN(this.actor.width)) { this.actor.width = 250; }
		if (Number.isNaN(this.actor.height)) { this.actor.height = 200; }
		if (Number.isNaN(this._fontSize)) { this._fontSize = 10; }
		this._saveState();
	}

	//--------------------------------------------------------------------------

	_applyTitleChange () {
		// TODO
		// ...
		this.onlySave();
	}

	_applyActorStyle () {
		if (this.actor == null) { return; }
		let is_hovered = this.actor.hover;
		let temp;
		if (is_hovered) {
			temp = 'background-color: rgba(' + this.customColor + ', 0.8);';
		} else {
			temp = 'background-color: rgba(' + this.customColor + ', 0.6);';
		}
		if(this._fontColor != '') {
			temp += 'color: ' + this._fontColor + ';';
		}
		this.actor.style = temp;
	}

	_applyNoteStyle () {
		let temp = 'background-color: rgba(' + this.customColor + ', 0.8);';
		if(this._fontColor != '') {
			temp += 'color: ' + this._fontColor + ';';
		}
		if(this._fontSize != 0) {
			temp += 'font-size: ' + this._fontSize + 'px;';
		}
		this.noteEntry.style = temp;
	}

	_getKeyFocus () {
		if (this.entry_is_visible) {
			this._grabHelper.grab({ actor: this.noteEntry });
			this.noteEntry.grab_key_focus();
		}
		this._redraw();
	}

	_leaveKeyFocus () {
		this._grabHelper.ungrab({ actor: this.noteEntry });
	}

	_redraw () {
		this.actor.get_parent().set_child_above_sibling(this.actor, null);
		this.onlySave();
	}

	//--------------------------------------------------------------------------
	// Sticky note's size and position -----------------------------------------

	_setNotePosition () {
		let monitor = Main.layoutManager.primaryMonitor;

		this.actor.set_position(
			monitor.x + Math.floor(this._x),
			monitor.y + Math.floor(this._y)
		);
	}

	_onMovePress (actor, event) {
		let mouseButton = event.get_button();
		if (mouseButton == 3) {
			this._entryBox.visible = !this._entryBox.visible;
			this.entry_is_visible = this._entryBox.visible;
		}
		this._onPressCommon(event);
		this._isMoving = true;
		this._isResizing = false;
	}

	_onResizePress (actor, event) {
		this._onPressCommon(event);
		this._isResizing = true;
		this._isMoving = false;
	}

	_onPressCommon (event) {
		this._redraw();
		this.grabX = Math.floor(event.get_coords()[0]);
		this.grabY = Math.floor(event.get_coords()[1]);
	}

	_onResizeMotion (actor, event) {
		if (!this._isResizing) { return; }
		let x = Math.floor(event.get_coords()[0]);
		let y = Math.floor(event.get_coords()[1]);
		this._resizeTo(x, y);
	}

	_resizeTo (event_x, event_y) {
		let newWidth = Math.abs(this.actor.width + (event_x - this.grabX));
		let newHeight = Math.abs(this._y + this.actor.height - event_y + (this.grabY - this._y));
		let newY = event_y - (this.grabY - this._y);

		newWidth = Math.max(newWidth, MIN_WIDTH);
		newHeight = Math.max(newHeight, MIN_HEIGHT);

		this.actor.width = newWidth;
		this.actor.height = newHeight;
		this._y = newY;
		this._setNotePosition();

		this.grabX = event_x;
		this.grabY = event_y;
	}

	_onMoveMotion (actor, event) {
		if (!this._isMoving) { return; }
		let x = Math.floor(event.get_coords()[0]);
		let y = Math.floor(event.get_coords()[1]);
		this._moveTo(x, y);
	}

	_moveTo (event_x, event_y) {
		let newX = event_x - (this.grabX - this._x);
		let newY = event_y - (this.grabY - this._y);

		this._y = Math.floor(newY);
		this._x = Math.floor(newX);
		this._setNotePosition();

		this.grabX = event_x;
		this.grabY = event_y;
	}

	_onRelease (actor, event) {
		this._isResizing = false;
		this._isMoving = false;
		this.onlySave();
	}

	//--------------------------------------------------------------------------
	// "Public" methods called by the NoteOptionsMenu's code -------------------

	changeFontSize (delta) {
		if (this._fontSize + delta > 1) {
			this._fontSize += delta;
			this._applyNoteStyle();
		}
		this.onlySave();
	}

	/*
	 * This applies the color from the menu. Metadata is saved after applying
	 * the new CSS.
	 */
	applyColorAndSave (r, g, b) {
		this._applyColor(r, g, b)
		this.onlySave();
	}

	//--------------------------------------------------------------------------

	_createNote () {
		Extension.NOTES_MANAGER.createNote(this.customColor, this._fontSize);
	}

	/*
	 * This applies the color, from the menu (`applyColorAndSave`) or the
	 * constructor (direct call). It requires some string manipulations since
	 * the color is saved in the text file using an 'r,g,b' string format. Then,
	 * the text coloration and the CSS is updated.
	 */
	_applyColor (r, g, b) {
		if (Number.isNaN(r)) r = 255;
		if (Number.isNaN(g)) g = 255;
		if (Number.isNaN(b)) b = 255;
		r = Math.min(Math.max(0, r), 255);
		g = Math.min(Math.max(0, g), 255);
		b = Math.min(Math.max(0, b), 255);
		this.customColor = r.toString() + ',' + g.toString() + ',' + b.toString();
		if (r + g + b > 250) {
			this._fontColor = '#000000';
		} else {
			this._fontColor = '#ffffff';
		}
		this._applyNoteStyle();
		this._applyActorStyle();
	}

	_loadText () {
		let file2 = GLib.build_filenamev([PATH, this.id.toString() + '_text']);
		if (!GLib.file_test(file2, GLib.FileTest.EXISTS)) {
			GLib.file_set_contents(file2, '');
		}

		let file = Gio.file_new_for_path(PATH + '/' + this.id.toString() + '_text');
		let [result, contents] = file.load_contents(null);
		if (!result) {
			log('Could not read file: ' + PATH);
		}
		let content = stringFromArray(contents);

		this.noteEntry.set_text(content);
	}

	_saveText () {
		let noteText = this.noteEntry.get_text();
		if (noteText == null) {
			noteText = '';
		}
		let file = GLib.build_filenamev([PATH, this.id.toString() + '_text']);
		GLib.file_set_contents(file, noteText);
	}

	/*
	 * This tries to find a random [x,y] which doesn't overlap with an existing
	 * note's header and which isn't out of the primary monitor. Of course, if
	 * there is notes everywhere, it just abandons computation, and sets the
	 * note in a random position (within the monitor or course).
	 */
	_computeRandomPosition () {
		let x;
		let y;
		for(var i = 0; i < 15; i++) {
			x = Math.random() * (Main.layoutManager.primaryMonitor.width - 300);
			y = Math.random() * (Main.layoutManager.primaryMonitor.height - 100);

			if (Extension.NOTES_MANAGER.areCoordsUsable(x, y)) {
				return [x, y];
			}
		}
		return [x, y];
	}

	_createDefaultState (fileName) {
		let defaultPosition = this._computeRandomPosition();
		let defaultContent = defaultPosition[0].toString() + ';'
		                   + defaultPosition[1].toString() + ';'
		                   + this.customColor + ';250;180;'
		                   + this._fontSize + ';true;'
		GLib.file_set_contents(fileName, defaultContent);
		return defaultContent;
	}

	_loadState () {
		let fname = GLib.build_filenamev([PATH, this.id.toString() + '_state']);
		if (!GLib.file_test(fname, GLib.FileTest.EXISTS)) {
			// If a _text file has no corresponding _state file
			this._createDefaultState(fname);
		}

		let file = Gio.file_new_for_path(fname);
		let [result, contents] = file.load_contents(null);
		let stringContent;
		if (!result) {
			log("Could not read sticky note state file: " + fname);
			stringContent = this._createDefaultState(fname);
		} else {
			stringContent = stringFromArray(contents);
		}

		let state = stringContent.split(';');
		this._x = Number(state[0]);
		this._y = Number(state[1]);
		this.customColor = state[2];
		this.actor.width = Number(state[3]);
		this.actor.height = Number(state[4]);
		this._fontSize = Number(state[5]);
		this.entry_is_visible = (state[6] == 'true');
	}

	_saveState () {
		let noteState = '';
		noteState += this._x.toString() + ';';
		noteState += this._y.toString() + ';';
		noteState += this.customColor.toString() + ';';
		noteState += this.actor.width.toString() + ';';
		noteState += this.actor.height.toString() + ';';
		noteState += this._fontSize.toString() + ';';
		noteState += this.entry_is_visible.toString() + ';';

		//log('_saveState | ' + this.id.toString() + ' | ' + noteState);
		let file = GLib.build_filenamev([PATH, this.id.toString() + '_state']);
		GLib.file_set_contents(file, noteState);
	}

	//--------------------------------------------------------------------------

	_deleteNoteObject () {
		let noteId = this.id;
		this.destroy();
		Extension.NOTES_MANAGER.postDelete(noteId);
	}

	destroy () {
		this.actor.destroy_all_children();
		this.actor.destroy();
		this.actor = null;
	}
};

//------------------------------------------------------------------------------

