// notes@maestroschan.fr/noteBox.js
// GPL v3
// Copyright Romain F. T.

const { Clutter, St, GLib, Gio } = imports.gi;
const Main = imports.ui.main;
const ShellEntry = imports.ui.shellEntry;
const GrabHelper = imports.ui.grabHelper;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Menus = Me.imports.menus;
const Extension = Me.imports.extension;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

// ~/.local/share/notes@maestroschan.fr
const PATH = GLib.build_pathv('/', [GLib.get_user_data_dir(), 'notes@maestroschan.fr']);

const MIN_HEIGHT = 50;
const MIN_WIDTH = 180;

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
 * Almost all of the init process is done in the build() method. Then, the other
 * methods are here for managing note state through buttons:
 * - The 'create' button, which creates a note with the same color and font
 *   size, but with random coordinates, an empty text, and an harcoded size.
 * - The 'delete' button, which delete the note and will call an exterior
 *   method. Requires validation from the user.
 * - The 'move' button, which isn't styled as a button but looks like an empty
 *   space. It simulates a kind of wacky window dragging.
 * - The 'options' button, showing a menu defined in menus.js
 * - The 'resize' button, which uses the same dragging mecanism as 'move', to
 *   resize the note from its upper-right corner.
 */
var NoteBox = class NoteBox {
	constructor (id, color, size) {
		this.id = id;
		this._fontSize = size;
		if (color.split(',').length == 3) {
			this.customColor = color;
		} else {
			this.customColor = '255,255,0';
		}
		this.build();
	}

	_setNotePosition () {
		let monitor = Main.layoutManager.primaryMonitor;
		
		this.actor.set_position(
			monitor.x + Math.floor(this._x),
			monitor.y + Math.floor(this._y)
		);
	}

	applyActorStyle () {
		if (this.actor == null) { return; } //XXX shouldn't exist
		var is_hovered = this.actor.hover;
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

	applyNoteStyle () {
		let temp = 'background-color: rgba(' + this.customColor + ', 0.8);';
		if(this._fontColor != '') {
			temp += 'color: ' + this._fontColor + ';';
		}
		if(this._fontSize != 0) {
			temp += 'font-size: ' + this._fontSize + 'px;';
		}
		this.noteEntry.style = temp;
	}

	build () {
		this.actor = new St.BoxLayout({
			reactive: true,
			vertical: true,
			min_height: 75,
			min_width: 245,
			style_class: 'noteBoxStyle',
			track_hover: true,
		});

		this._fontColor = '';
		this.loadState();
		this.applyActorStyle();
		this._buildHeaderbar();

		//----------------------------------------------------------------------

		this._scrollView = new St.ScrollView({
			overlay_scrollbars: true,
			// if true, the scrollbar is inside the textfield, else it's outside
			x_expand: true,
			y_expand: true,
			x_fill: true,
			y_fill: true
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

		this.entry_box = new St.BoxLayout({
			reactive: true,
			x_expand: true,
			y_expand: true,
			visible: this.entry_is_visible,
		});

		this.entry_box.add_actor(this.noteEntry);
		this._scrollView.add_actor(this.entry_box);
		this.actor.add_actor(this._scrollView);

		//----------------------------------------------------------------------

		this._grabHelper = new GrabHelper.GrabHelper(this.noteEntry)
		if (Extension.AUTO_FOCUS) {
			this.noteEntry.connect('enter-event', this.getKeyFocus.bind(this));
			this.noteEntry.connect('leave-event', this.leaveKeyFocus.bind(this));
		} else {
			this.noteEntry.connect('button-press-event', this.getKeyFocus.bind(this));
			this.noteEntry.connect('leave-event', this.leaveKeyFocus.bind(this)); //XXX
		}
		this.actor.connect('notify::hover', this.applyActorStyle.bind(this));

		//----------------------------------------------------------------------

		// Each note sets its own actor where it should be. This isn't a problem
		// since the related setting isn't directly accessed, but is stored in
		// 'Extension.Z_POSITION' instead, which prevent inconstistencies.
		this.load_in_the_right_actor();
		this._setNotePosition();
		this.loadText();
		// ShellEntry.addContextMenu(this.noteEntry); // FIXME doesn't work
		this._initStyle();

		this.grabX = this._x + 100;
		this.grabY = this._y + 10;
	}

	_buildHeaderbar () {
		// This is the regular header, as described above.
		this.buttons_box = new St.BoxLayout({
			vertical: false,
			visible: true,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'noteHeaderStyle',
		});

		let btnNew = new Menus.RoundButton(this, 'list-add-symbolic', _("New"));
		btnNew.actor.connect('clicked', this.createNote.bind(this));
		this.buttons_box.add(btnNew.actor);

		let btnDelete = new Menus.RoundButton(this, 'user-trash-symbolic', _("Delete"));
		btnDelete.actor.connect('clicked', this.showDelete.bind(this));
		this.buttons_box.add(btnDelete.actor);

		this.moveBox = new St.Button({
			x_expand: true,
			x_fill: true,
			y_fill: true,
			style_class: 'notesTitleButton',
			// label: 'example title'
		})
		this.buttons_box.add(this.moveBox, {x_expand: true});

		let btnOptions = new Menus.RoundButton(this, 'view-more-symbolic', _("Note options"));
		btnOptions.addMenu();
		this.buttons_box.add(btnOptions.actor);

		let ctrlButton = new Menus.RoundButton(this, 'view-restore-symbolic', _("Resize"));
		this.buttons_box.add(ctrlButton.actor);

		this.moveBox.connect('button-press-event', this._onMovePress.bind(this));
		this.moveBox.connect('motion-event', this._onMoveMotion.bind(this));
		this.moveBox.connect('button-release-event', this._onRelease.bind(this));

		ctrlButton.actor.connect('button-press-event', this._onResizePress.bind(this));
		ctrlButton.actor.connect('motion-event', this._onResizeMotion.bind(this));
		ctrlButton.actor.connect('button-release-event', this._onRelease.bind(this));

		this._addDeleteBox();
		this._addEditTitleBox();
	}

	_addEditTitleBox () {
		// TODO
	}

	_addDeleteBox () {
		// This is the UI for deletion. The whole box is hidden by default, and
		// will be shown instead of the regular header if the user needs it.
		this.delete_box = new St.BoxLayout({
			vertical: false,
			visible: false,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'noteHeaderStyle',
		});

		let btnBack = new Menus.RoundButton(this, 'go-previous-symbolic', _("Back"));
		btnBack.actor.connect('clicked', this.hideDelete.bind(this));
		this.delete_box.add(btnBack.actor);
		this.delete_box.add_actor(new St.Label({
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			text: _("Delete this note?")
		}));
		let btnConfirm = new Menus.RoundButton(this, 'user-trash-symbolic', _("Confirm"));
		btnConfirm.actor.connect('clicked', this.deleteNote.bind(this));
		this.delete_box.add(btnConfirm.actor);

		this.actor.add_actor(this.buttons_box);
		this.actor.add_actor(this.delete_box);
	}

	_initStyle () {
		let initialRGB_r = this.customColor.split(',')[0];
		let initialRGB_g = this.customColor.split(',')[1];
		let initialRGB_b = this.customColor.split(',')[2];
		this.applyColor(initialRGB_r, initialRGB_g, initialRGB_b);
		this.applyActorStyle();
		this.applyNoteStyle();
	}

	getKeyFocus () {
		if (this.entry_is_visible) {
			this._grabHelper.grab({ actor: this.noteEntry });
			this.noteEntry.grab_key_focus();
		}
		this.redraw();
	}

	leaveKeyFocus () {
		this._grabHelper.ungrab({ actor: this.noteEntry });
	}

	load_in_the_right_actor () {
		if (Extension.Z_POSITION == 'above-all') {
			Main.layoutManager.addChrome(this.actor, {
				affectsInputRegion: true
			});
		} else {
			Main.layoutManager._backgroundGroup.add_actor(this.actor);
		}
	}

	remove_from_the_right_actor () {
		if (Extension.Z_POSITION == 'above-all') {
//			Main.layoutManager.untrackChrome(this.actor);
			Main.layoutManager.removeChrome(this.actor);
		} else {
			Main.layoutManager._backgroundGroup.remove_actor(this.actor);
		}
	}

	//--------------------------------------------------------------------------

	_onMovePress (actor, event) {
		let mouseButton = event.get_button();
		if (mouseButton == 3) {
			this.entry_box.visible = !this.entry_box.visible;
			this.entry_is_visible = this.entry_box.visible;
		}
		this.onPress(event);
		this._isMoving = true;
		this._isResizing = false;
	}

	_onResizePress (actor, event) {
		this.onPress(event);
		this._isResizing = true;
		this._isMoving = false;
	}

	onPress (event) {
		this.redraw();
		this.grabX = Math.floor(event.get_coords()[0]);
		this.grabY = Math.floor(event.get_coords()[1]);
	}

	_onRelease (actor, event) {
		this._isResizing = false;
		this._isMoving = false;
		this.onlySave();
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

	//--------------------------------------------------------------------------

	redraw () {
		this.actor.get_parent().set_child_above_sibling(this.actor, null);
		this.onlySave();
	}

	showDelete () {
		this.redraw();
		this.buttons_box.visible = false;
		this.delete_box.visible = true;
	}

	hideDelete () {
		this.redraw();
		this.delete_box.visible = false;
		this.buttons_box.visible = true;
	}

	blackFontColor () {
		this._fontColor = '#000000';
		this.applyActorStyle();
		this.applyNoteStyle();
	}

	whiteFontColor () {
		this._fontColor = '#ffffff';
		this.applyActorStyle();
		this.applyNoteStyle();
	}

	crementFontSize (delta) {
		if (this._fontSize + delta > 1) {
			this._fontSize += delta;
			this.applyNoteStyle();
		}
	}

	/*
	 * This weird crap applies the color from the 3 entries. It requires string
	 * manipulations since the color is set in a text file in an 'r,g,b' format.
	 * Then, the text coloration and the CSS is updated.
	 */
	applyColor (r, g, b) {
		if (Number.isNaN(r)) { r = 255; }
		if (Number.isNaN(g)) { g = 255; }
		if (Number.isNaN(b)) { b = 255; }
		r = Math.min(Math.max(0, r), 255);
		g = Math.min(Math.max(0, g), 255);
		b = Math.min(Math.max(0, b), 255);
		this.customColor = r.toString() + ',' + g.toString() + ',' + b.toString();
		if (r + g + b > 250) {
			this.blackFontColor();
		} else {
			this.whiteFontColor();
		}
		this.applyNoteStyle();
		this.applyActorStyle();
	}

	loadText () {
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

	saveText () {
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
	 * note in a 100% random position.
	 */
	computeRandomPosition () {
		let x;
		let y;
		for(var i = 0; i < 15; i++) {
			x = Math.random() * (Main.layoutManager.primaryMonitor.width - 300);
			y = Math.random() * (Main.layoutManager.primaryMonitor.height - 100);

			let can = true;
			Extension.ALL_NOTES.forEach(function (n) {
				if( (Math.abs(n._x - x) < 230) && (Math.abs(n._y - y) < 100) ) {
					can = false;
				}
			});

			if (can) {
				return [x, y];
			}
		}
		return [x, y];
	}

	loadState () {
		let file2 = GLib.build_filenamev([PATH, this.id.toString() + '_state']);
		if (!GLib.file_test(file2, GLib.FileTest.EXISTS)) {
			// If a _text file has no corresponding _state file
			let defaultPosition = this.computeRandomPosition();
			GLib.file_set_contents(
				file2,
				defaultPosition[0].toString() + ';' + defaultPosition[1].toString()
				+ ';' + this.customColor + ';250;200;' + this._fontSize + ';true;'
			);
		}

		let file = Gio.file_new_for_path(PATH + '/' + this.id.toString() + '_state');
		let [result, contents] = file.load_contents(null);
		if (!result) {
			log('Could not read file: ' + PATH);
		}
		let content = stringFromArray(contents);

		let state = content.split(';');
		this._x = Number(state[0]);
		this._y = Number(state[1]);
		this.customColor = state[2];
		this.actor.width = Number(state[3]);
		this.actor.height = Number(state[4]);
		this._fontSize = Number(state[5]);
		this.entry_is_visible = (state[6] == 'true');
	}

	saveState () {
		let noteState = '';
		noteState += this._x.toString() + ';';
		noteState += this._y.toString() + ';';
		noteState += this.customColor.toString() + ';';
		noteState += this.actor.width.toString() + ';';
		noteState += this.actor.height.toString() + ';';
		noteState += this._fontSize.toString() + ';';
		noteState += this.entry_is_visible.toString() + ';';

		//log('saveState | ' + this.id.toString() + ' | ' + noteState);
		let file = GLib.build_filenamev([PATH, this.id.toString() + '_state']);
		GLib.file_set_contents(file, noteState);
	}

	fixState () {
		let outX = (this._x < 0 || this._x > Main.layoutManager.primaryMonitor.width - 20);
		let outY = (this._y < 0 || this._y > Main.layoutManager.primaryMonitor.height - 20);
		if (outX || outY) {
			[this._x, this._y] = this.computeRandomPosition();
			this._setNotePosition();
		}
		if (Number.isNaN(this._x)) { this._x = 10; }
		if (Number.isNaN(this._y)) { this._y = 10; }
		if (Number.isNaN(this.actor.width)) { this.actor.width = 250; }
		if (Number.isNaN(this.actor.height)) { this.actor.height = 200; }
		if (Number.isNaN(this._fontSize)) { this._fontSize = 10; }
		this.saveState();
	}

	createNote () {
		let nextId = Extension.ALL_NOTES.length; // XXX not very elegant...
		Extension.ALL_NOTES.push(new NoteBox(nextId, this.customColor, this._fontSize));
	}

	deleteNote () {
		this.destroy();
		Extension.refreshArray();
		Extension.saveAllNotes();
	}

	destroy () {
		this.actor.destroy_all_children();
		this.actor.destroy();
		this.actor = null;
	}

	show () {
		this.actor.visible = true;
		if (Extension.Z_POSITION == 'above-all') {
			Main.layoutManager.trackChrome(this.actor);
		}
	}

	hide () {
		this.onlyHide();
		this.onlySave();
	}

	onlyHide () {
		this.actor.visible = false;
		if (Extension.Z_POSITION == 'above-all') {
			Main.layoutManager.untrackChrome(this.actor);
		}
	}

	onlySave () {
		this.saveState();
		this.saveText();
	}
};

//------------------------------------------------------------------------------

