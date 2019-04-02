

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Menus = Me.imports.menus;
const Extension = Me.imports.extension;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

const MOVE_ANIMATION_TIME = 0.4;
const RESIZE_ANIMATION_TIME = 0.2;

// ~/.local/share/notes@maestroschan.fr
const PATH = GLib.build_pathv('/', [GLib.get_user_data_dir(), 'notes@maestroschan.fr']);

let SIGNAL_LAYOUT;
let SIGNAL_BRING_BACK;
let SIGNAL_ICON;

//------------------------------------------------------------------------------

function stringFromArray(data){
	if (data instanceof Uint8Array) {
		return imports.byteArray.toString(data);
	} else {
		return data.toString();
	}
}

/*
 * This class stands for one note. The note's id corresponds to the name of files where its data
 * will be stored. The note's state is loaded and the note is built, then the note's text is loaded.
 * Almost all of the init process is done in the build() method. Then, the other methods are here
 * for managing note state through buttons:
 * - The 'create' button, which creates a note with the same color and font size, but with random
 * 	coordinates, an empty text, and an harcoded size.
 * - The 'delete' button, which delete the note and will call an exterior method. Requires validation.
 * - The 'options' button, showing a menu defined in menus.js
 * - The 'move' button, which isn't drawn as a button, but looks like an empty space. It emulates a
 * 	kind of wacky bootleg of drag-and-drop.
 * - The 'resize' button, which uses the same drag-and-drop emulation and resizes the note from its
 * 	upper-right corner.
 */
var NoteBox = class NoteBox {
	constructor (id, color, size) {
		this.id = id;
		this._fontSize = size;
		this.customColor = color;
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
		var is_hovered = this.actor.hover;
		let temp;
		if (is_hovered) {
			temp = 'background-color: rgba(' + this.customColor + ', 0.7);';
		} else {
			temp = 'background-color: rgba(' + this.customColor + ', 0.4);';
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

	_addButton (box, icon, accessibleName) {
		let button = new St.Button({
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
		box.add(button);
		return button;
	}

	build () {
		this.actor = new St.BoxLayout({
			reactive: true,
			vertical: true,
			min_height: 75,
			min_width: 245,
			style_class: 'noteStyle',
			track_hover: true,
		});
		
		this._fontColor = '';
		this.loadState();
		this.applyActorStyle();
		
		this.actor.connect('enter-event', this.getKeyFocus.bind(this));
		this.actor.connect('notify::hover', this.applyActorStyle.bind(this));
//		this.actor.connect('notify::hover', (a, b) => { this.applyActorStyle(); });
		
		// This is the regular header, as described above.
		this.buttons_box = new St.BoxLayout({
			vertical: false,
			visible: true,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'boxStyle',
		});
		
		this._addButton(this.buttons_box,'list-add-symbolic', _("New")).connect('clicked', this.createNote.bind(this));
		this._addButton(this.buttons_box,'user-trash-symbolic', _("Delete")).connect('clicked', this.showDelete.bind(this));
		
		let optionsButton = this._addButton(this.buttons_box, 'view-more-symbolic', _("Note options"));
		this.optionsMenuButton = new Menus.RoundMenuButton(this, optionsButton);

		this.moveBox = new St.Button({
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			label: ''
		})
		this.buttons_box.add_actor(this.moveBox);

		let ctrlButton = this._addButton(this.buttons_box,'view-restore-symbolic', _("Resize"));
		
		this.moveBox.connect('button-press-event', this._onPress.bind(this));
		this.moveBox.connect('button-release-event', this._onMoveRelease.bind(this));
		
		ctrlButton.connect('button-press-event', this._onPress.bind(this));
		ctrlButton.connect('button-release-event', this._onResizeRelease.bind(this));
		
		/*
		 * This is the interface for custom color. It is mainly useless. The whole box is hidden by
		 * default, and will be shown instead of the regular header if the user needs it.
		 */
		this.color_box = new St.BoxLayout({
			vertical: false,
			visible: false,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'boxStyle',
		});
		
		this.colorEntryR = new St.Entry({
			name: 'colorEntryR',
			can_focus: true,
			track_hover: true,
			x_expand: true
		});
		this.colorEntryV = new St.Entry({
			name: 'colorEntryV',
			can_focus: true,
			track_hover: true,
			x_expand: true
		});
		this.colorEntryB = new St.Entry({
			name: 'colorEntryB',
			can_focus: true,
			track_hover: true,
			x_expand: true
		});
		this.colorEntryR.set_text(this.customColor.split(',')[0]);
		this.colorEntryV.set_text(this.customColor.split(',')[1]);
		this.colorEntryB.set_text(this.customColor.split(',')[2]);
		this.colorEntryR.style = 'background-color: #BB3322; color: #FFFFFF';
		this.colorEntryV.style = 'background-color: #22BB33; color: #FFFFFF';
		this.colorEntryB.style = 'background-color: #2233BB; color: #FFFFFF';
		
		this._addButton(this.color_box, 'go-previous-symbolic', _("Back")).connect('clicked', this.hideColor.bind(this));

		this.color_box.add_actor(this.colorEntryR);
		this.color_box.add_actor(this.colorEntryV);
		this.color_box.add_actor(this.colorEntryB);
		this._addButton(this.color_box, 'object-select-symbolic', _("OK")).connect('clicked', this.applyColor.bind(this));
		
		// This is the UI for deletion. The whole box is hidden by default, and will
		// be shown instead of the regular header if the user needs it.
		this.delete_box = new St.BoxLayout({
			vertical: false,
			visible: false,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'boxStyle',
		});
		
		this._addButton(this.delete_box, 'go-previous-symbolic', _("Back")).connect('clicked', this.hideDelete.bind(this));
		this.delete_box.add_actor(new St.Label({
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			text: _("Delete this note?")
		}));
		this._addButton(this.delete_box, 'user-trash-symbolic', _("OK")).connect('clicked', this.deleteNote.bind(this));
		
		//-------------
		
		this.actor.add_actor(this.buttons_box);
		this.actor.add_actor(this.delete_box);
		this.actor.add_actor(this.color_box);
		
		//-------------
		
		this._scrollView = new St.ScrollView({
			overlay_scrollbars: true, //if true, the scrollbar is inside the textfield, else it's outside
			x_expand: true,
			y_expand: true,
			x_fill: true,
			y_fill: true
		});
//		this._scrollView.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC); //TODO ?
		
		this.actor.add_actor(this._scrollView);
		
		this.noteEntry = new St.Entry({
			name: 'noteEntry',
			can_focus: true,
			hint_text: _("Type here…"),
			track_hover: true,
			x_expand: true,
			style_class: 'textfield',
		});
		let clutterText = this.noteEntry.get_clutter_text();
		clutterText.set_single_line_mode(false);
		clutterText.set_activatable(false); // we can press Enter
		clutterText.set_line_wrap(true);
		clutterText.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);
		
		this.applyNoteStyle();
		this.applyColor();
		
		this.entry_box = new St.BoxLayout({
			reactive: true,
			x_expand: true,
			y_expand: true,
			visible: this.entry_is_visible,
		});
		
		this.entry_box.add_actor(this.noteEntry);
		this._scrollView.add_actor(this.entry_box);
		
		//------------
		
		/*
		 * Each note sets its own actor where it should be. This isn't a problem since the
		 * related setting isn't directly accessed, but is stored in 'Extension.Z_POSITION' instead,
		 * which prevent inconstistencies.
		 */
		this.load_in_the_right_actor();
		
		this._setNotePosition();
		
		this.loadText();
		
		Menus.addContextMenu(this.noteEntry, this);
		
		this.grabX = this._x + 100;
		this.grabY = this._y + 10;
	}

	getKeyFocus() {
		if (this.entry_is_visible) {
			this.noteEntry.grab_key_focus();
		}
		this.redraw();
	}

	load_in_the_right_actor () {
		if(Extension.Z_POSITION == 'above-all') {
			Main.layoutManager.addChrome(this.actor);
		} else if (Extension.Z_POSITION == 'special-layer') {
			Main.layoutManager.notesGroup.add_actor(this.actor);
		} else {
			Main.layoutManager._backgroundGroup.add_actor(this.actor);
		}
	}

	remove_from_the_right_actor () {
		if(Extension.Z_POSITION == 'above-all') {
//			Main.layoutManager.untrackChrome(this.actor);
			Main.layoutManager.removeChrome(this.actor);
		} else if (Extension.Z_POSITION == 'special-layer') {
			Main.layoutManager.notesGroup.remove_actor(this.actor);
		} else {
			Main.layoutManager._backgroundGroup.remove_actor(this.actor);
		}
	}

	_onPress (actor, event) {
		this.redraw();
		let mouseButton = event.get_button();
		if (mouseButton == 3) {
			this.entry_box.visible = !this.entry_box.visible;
			this.entry_is_visible = this.entry_box.visible;
		}
		this.grabX = Math.floor(event.get_coords()[0]);
		this.grabY = Math.floor(event.get_coords()[1]);
	}

	_onResizeRelease (actor, event) {
		//FIXME TODO minimaux ?
		let newWidth = Math.abs(this.actor.width + (Math.floor(event.get_coords()[0]) - this.grabX));
		let newHeight = Math.abs(this._y + this.actor.height - Math.floor(event.get_coords()[1]) + (this.grabY - this._y));
		let newY = Math.floor(event.get_coords()[1]) - (this.grabY - this._y);
		
		Tweener.addTween(this, {
			positionWidth: newWidth,
			time: RESIZE_ANIMATION_TIME,
			transition: 'easeOutQuad',
			onComplete: function () {
				this.actor.width = newWidth;
			}
		});
		
		Tweener.addTween(this, {
			positionHeight: newHeight,
			time: RESIZE_ANIMATION_TIME,
			transition: 'easeOutQuad',
			onComplete: function () {
				this.actor.height = newHeight;
			}
		});
		
		Tweener.addTween(this, {
			positionY: newY,
			time: RESIZE_ANIMATION_TIME,
			transition: 'easeOutQuad',
			onComplete: function () {
				this._y = newY;
				this._setNotePosition();
			}
		});
		
		this.onlySave();
	}

	//--------------------
	
	/* These getters and setters are here only for Tweener's animations */
	
	get positionWidth () {
		return this.actor.width;
	}

	set positionWidth (value){
		this.actor.width = value;
	}

	get positionHeight () {
		return this.actor.height;
	}

	set positionHeight (value){
		this.actor.height = value;
	}

	get positionX () {
		return this._x;
	}

	set positionX (value){
		this._x = value;
		this._setNotePosition();
	}

	get positionY () {
		return this._y;
	}

	set positionY (value){
		this._y = value;
		this._setNotePosition();
	}

	//--------------------
	
	_onMoveRelease (actor, event) {
		let newX = Math.floor(event.get_coords()[0]) - (this.grabX - this._x);
		let newY = Math.floor(event.get_coords()[1]) - (this.grabY - this._y);
		
		Tweener.addTween(this, {
			positionY: newY,
			time: MOVE_ANIMATION_TIME,
			transition: 'easeOutQuad',
			onComplete: function () {
				this._y = newY;
				this._setNotePosition();
			}
		});
		
		Tweener.addTween(this, {
			positionX: newX,
			time: MOVE_ANIMATION_TIME,
			transition: 'easeOutQuad',
			onComplete: function () {
				this._x = newX;
				this._setNotePosition();
			}
		});
		
		this.onlySave();
	}

	redraw () {
		this.actor.raise_top();
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

	showColor () {
		this.redraw();
		this.buttons_box.visible = false;
		this.color_box.visible = true;
	}

	hideColor () {
		this.redraw();
		this.color_box.visible = false;
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

	// This weird crap applies the custom color from the 3 entries. It requires
	// string manipulations since the color is set in a text file in the 'r,g,b'
	// format. Also, the text coloration needs to be updated.
	applyColor () {
		let temp = '';
		let total = 0;
		if(Number(this.colorEntryR.get_text()) < 0) {
			temp += '0,';
			total += 0;
			this.colorEntryR.set_text('0');
		} else if(Number(this.colorEntryR.get_text()) > 255) {
			temp += '255,';
			total += 255;
			this.colorEntryR.set_text('255');
		} else {
			temp += Number(this.colorEntryR.get_text()).toString() + ',';
			total += Number(this.colorEntryR.get_text());
		}
		if(Number(this.colorEntryV.get_text()) < 0) {
			temp += '0,';
			total += 0;
			this.colorEntryV.set_text('0');
		} else if(Number(this.colorEntryV.get_text()) > 255) {
			temp += '255,';
			total += 255;
			this.colorEntryV.set_text('255');
		} else {
			temp += Number(this.colorEntryV.get_text()).toString() + ',';
			total += Number(this.colorEntryV.get_text());
		}
		if(Number(this.colorEntryB.get_text()) < 0) {
			temp += '0';
			total += 0;
			this.colorEntryB.set_text('0');
		} else if(Number(this.colorEntryB.get_text()) > 255) {
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
		this.applyNoteStyle();
		this.applyActorStyle();
	}

	applyPresetColor (color) {
		this.blackFontColor();
		let temp;
		switch(color) {
			case 'red':
				temp = '250,0,0';
				this.whiteFontColor();
				break;
			case 'magenta':
				temp = '255,0,255';
				break;
			case 'yellow':
				temp = '255,255,0';
				break;
			case 'white':
				temp = '255,255,255';
				break;
			case 'cyan':
				temp = '0,255,255';
				break;
			case 'green':
				temp = '0,255,0';
				break;
			case 'blue':
				temp = '0,0,250';
				this.whiteFontColor();
				break;
			case 'black':
			default:
				temp = '10,10,10';
				this.whiteFontColor();
				break;
		}
		this.customColor = temp;
		this.applyNoteStyle();
		this.applyActorStyle();
	}

	loadText () {
		let file2 = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_text']);
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
		let file = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_text']);
		GLib.file_set_contents(file, noteText);
	}

	/*
	 * This tries to find a random [x,y] which doesn't overlap with an existing note's header
	 * and which isn't out of the primary monitor. Of course, if there is notes everywhere,
	 * it just abandons computation, and sets the note in a 100% random position.
	 */
	computeRandomPosition () {
		let x;
		let y;
		for(var i = 0; i < 15; i++) {
			x = Math.random() * (Main.layoutManager.primaryMonitor.width - 300);
			y = Math.random() * (Main.layoutManager.primaryMonitor.height - 100);
		
			let can = true;
			Extension.ALL_NOTES.forEach(function (n) {
				if( ( Math.abs(n._x - x) < 230) && ( Math.abs(n._y - y) < 100) ) {
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
		let file2 = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_state']);
		if (!GLib.file_test(file2, GLib.FileTest.EXISTS)) {
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
		let file = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_state']);
		GLib.file_set_contents(file, noteState);
	}

	createNote () {
		let nextId = Extension.ALL_NOTES.length;
		Extension.ALL_NOTES.push(new NoteBox(nextId, this.customColor, this._fontSize)); //FIXME
	}

	deleteNote () {
		this.destroy();
		refreshArray();
		saveAllNotes();
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


