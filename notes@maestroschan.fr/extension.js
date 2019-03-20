const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Shell = imports.gi.Shell;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;

const PanelMenu = imports.ui.panelMenu;
const Panel = imports.ui.panel;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Menus = Me.imports.menus;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

const MOVE_ANIMATION_TIME = 0.4;
const RESIZE_ANIMATION_TIME = 0.2;

// ~/.local/share/notes@maestroschan.fr
const PATH = GLib.build_pathv('/', [GLib.get_user_data_dir(), 'notes@maestroschan.fr']);

let globalButton;
let SETTINGS;
let Z_POSITION;
let GLOBAL_ARE_VISIBLE;

/*
 * This is used only if the selected Z_POSITION is 'in-overview',
 * a.k.a. the notes will be shown in the overview if it's empty.
 */
let SIGNAUX = [];

let SIGNAL_LAYOUT;
let SIGNAL_BRING_BACK;
let SIGNAL_ICON;

//-------------------------------------------------

let allNotes;

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
	Z_POSITION = "";
}

//------------------------------------------------

function stringFromArray(data){
	if (data instanceof Uint8Array) {
		return imports.byteArray.toString(data);
	} else {
		return data.toString();
	}
}

function saveAllNotes () {
	
	allNotes.forEach(function (n) {
		if(n.actor != null) {
			n.saveState();
			n.saveText();
		}
	});
}

function refreshArray () {
	let temp = new Array();
	allNotes.forEach(function (n) {
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
	
	let textfile = Gio.file_new_for_path(PATH + '/' + allNotes.length.toString() + '_text');
	let statefile = Gio.file_new_for_path(PATH + '/' + allNotes.length.toString() + '_state');
	textfile.delete(null);
	statefile.delete(null);
}

//------------------------------------------------

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
const NoteBox = new Lang.Class({
	Name:	'NoteBox',
	
	_init: function (id, color, size) {
		this.id = id;
		this._fontSize = size;
		this.customColor = color;
		this.build();
	},
	
	_setNotePosition: function () {
		let monitor = Main.layoutManager.primaryMonitor;
		
		this.actor.set_position(
			monitor.x + Math.floor(this._x),
			monitor.y + Math.floor(this._y)
		);
	},
	
	applyActorStyle: function (){
		var is_hovered = this.actor.hover;
		let temp;
		if (is_hovered) {
			temp = 'background-color: rgba(' + this.customColor + ', 0.7);';
//			if(this._fontColor != '') {
//				temp += 'color: ' + this._fontColor + ';';
//			}
		} else {
			temp = 'background-color: rgba(' + this.customColor + ', 0.4);';
//			temp += 'color: rgba(' + this.customColor + ', 0.7);';
		}
		if(this._fontColor != '') {
			temp += 'color: ' + this._fontColor + ';';
		}
		this.actor.style = temp;
	},
	
	applyNoteStyle: function () {
		let temp = 'background-color: rgba(' + this.customColor + ', 0.8);';
		if(this._fontColor != '') {
			temp += 'color: ' + this._fontColor + ';';
		}
		if(this._fontSize != 0) {
			temp += 'font-size: ' + this._fontSize + 'px;';
		}
		this.noteEntry.style = temp;
	},
	
	_addButton: function (box, icon, accessibleName) {

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
	},
	
	build: function () {
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
		
		this.actor.connect('enter-event', Lang.bind(this, this.getKeyFocus));
		this.actor.connect('notify::hover', Lang.bind(this, function(a, b) {
			this.applyActorStyle();
		}));
		
		/*
		 * This is the regular header, as described above.
		 */
		this.buttons_box = new St.BoxLayout({
			vertical: false,
			visible: true,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'boxStyle',
		});
		
		this._addButton(this.buttons_box,'list-add-symbolic', _("New")).connect('clicked', Lang.bind(this, this.createNote));
		this._addButton(this.buttons_box,'user-trash-symbolic', _("Delete")).connect('clicked', Lang.bind(this, this.showDelete));
		
		let optionsButton = this._addButton(this.buttons_box, 'view-more-symbolic', _("Note options"));
		this.optionsMenuButton = new Menus.RoundMenuButton( this, optionsButton );

		this.moveBox = new St.Button({
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			label: ''
		})
		this.buttons_box.add_actor(this.moveBox);

		let ctrlButton = this._addButton(this.buttons_box,'view-restore-symbolic', _("Resize"));
		
		this.moveBox.connect('button-press-event', Lang.bind(this, this._onPress));
		this.moveBox.connect('button-release-event', Lang.bind(this, this._onMoveRelease));
		
		ctrlButton.connect('button-press-event', Lang.bind(this, this._onPress));
		ctrlButton.connect('button-release-event', Lang.bind(this, this._onResizeRelease));
		
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
		
		this._addButton(this.color_box, 'go-previous-symbolic', _("Back")).connect('clicked', Lang.bind(this, this.hideColor));

		this.color_box.add_actor(this.colorEntryR);
		this.color_box.add_actor(this.colorEntryV);
		this.color_box.add_actor(this.colorEntryB);
		this._addButton(this.color_box, 'object-select-symbolic', _("OK")).connect('clicked', Lang.bind(this, this.applyColor));
		
		/*
		 * This is the interface for deletion. The whole box is hidden by default, and will
		 * be shown instead of the regular header if the user needs it.
		 */
		this.delete_box = new St.BoxLayout({
			vertical: false,
			visible: false,
			reactive: true,
			x_expand: true,
			y_expand: false,
			style_class: 'boxStyle',
		});
		
		this._addButton(this.delete_box, 'go-previous-symbolic', _("Back")).connect('clicked', Lang.bind(this, this.hideDelete));
		this.delete_box.add_actor(new St.Label({
			x_expand: true,
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			text: _("Delete this note?")
		}));
		this._addButton(this.delete_box, 'user-trash-symbolic', _("OK")).connect('clicked', Lang.bind(this, this.deleteNote));
		
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
		 * related setting isn't directly accessed, but is stored in 'Z_POSITION' instead,
		 * which prevent inconstistencies.
		 */
		this.load_in_the_right_actor();
		
		this._setNotePosition();
		
		this.loadText();
		
		Menus.addContextMenu(this.noteEntry, this);
		
		this.grabX = this._x + 100;
		this.grabY = this._y + 10;
	},
	
	getKeyFocus: function() {
		if (this.entry_is_visible) {
			this.noteEntry.grab_key_focus();
		}
		this.redraw();
	},
	
	load_in_the_right_actor: function () {
		if(Z_POSITION == 'above-all') {
			Main.layoutManager.addChrome(this.actor);
		} else if (Z_POSITION == 'special-layer') {
			Main.layoutManager.notesGroup.add_actor(this.actor);
		} else if (Z_POSITION == 'in-overview') {
			Main.layoutManager.overviewGroup.add_actor(this.actor);
		} else {
			Main.layoutManager._backgroundGroup.add_actor(this.actor);
		}
	},
	
	remove_from_the_right_actor: function () {
		if(Z_POSITION == 'above-all') {
//			Main.layoutManager.untrackChrome(this.actor);
			Main.layoutManager.removeChrome(this.actor);
		} else if (Z_POSITION == 'special-layer') {
			Main.layoutManager.notesGroup.remove_actor(this.actor);
		} else if (Z_POSITION == 'in-overview') {
			Main.layoutManager.overviewGroup.remove_actor(this.actor);
		} else {
			Main.layoutManager._backgroundGroup.remove_actor(this.actor);
		}
	},
	
	_onPress: function (actor, event) {
		this.redraw();
		let mouseButton = event.get_button();
		if (mouseButton == 3) {
			this.entry_box.visible = !this.entry_box.visible;
			this.entry_is_visible = this.entry_box.visible;
		}
		this.grabX = Math.floor(event.get_coords()[0]);
		this.grabY = Math.floor(event.get_coords()[1]);
	},
	
	_onResizeRelease: function (actor, event) {
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
	},
	
	//--------------------
	
	/* These getters and setters are here only for Tweener's animations */
	
	get positionWidth() {
		return this.actor.width;
	},
	
	set positionWidth(value){
		this.actor.width = value;
	},
	
	get positionHeight() {
		return this.actor.height;
	},
	
	set positionHeight(value){
		this.actor.height = value;
	},
	
	get positionX() {
		return this._x;
	},
	
	set positionX(value){
		this._x = value;
		this._setNotePosition();
	},
	
	get positionY() {
		return this._y;
	},
	
	set positionY(value){
		this._y = value;
		this._setNotePosition();
	},
	
	//--------------------
	
	_onMoveRelease: function (actor, event) {
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
	},
	
	redraw: function () {
		this.actor.raise_top();
		this.onlySave();
	},
	
	showDelete: function () {
		this.redraw();
		this.buttons_box.visible = false;
		this.delete_box.visible = true;
	},
	
	hideDelete: function () {
		this.redraw();
		this.delete_box.visible = false;
		this.buttons_box.visible = true;
	},
	
	showColor: function () {
		this.redraw();
		this.buttons_box.visible = false;
		this.color_box.visible = true;
	},
	
	hideColor: function () {
		this.redraw();
		this.color_box.visible = false;
		this.buttons_box.visible = true;
	},
	
	blackFontColor: function () {
		this._fontColor = '#000000';
		this.applyActorStyle();
		this.applyNoteStyle();
	},
	
	whiteFontColor: function () {
		this._fontColor = '#ffffff';
		this.applyActorStyle();
		this.applyNoteStyle();
	},
	
	/*
	 * This weird crap applies the custom color from the 3 entries. It requires
	 * string manipulations since the color is set in a text file in the 'r,g,b'
	 * format. Also, the text coloration needs to be updated.
	 */
	applyColor: function () {
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
	},
	
	loadText: function () {
	
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
	},
	
	saveText: function () {
		let noteText = this.noteEntry.get_text();
		if (noteText == null) {
			noteText = '';
		}
		let file = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_text']);
		GLib.file_set_contents(file, noteText);
	},
	
	/*
	 * This tries to find a random [x,y] which doesn't overlap with an existing note's header
	 * and which isn't out of the primary monitor. Of course, if there is notes everywhere,
	 * it just abandons computation, and sets the note in a 100% random position.
	 */
	computeRandomPosition: function () {
		let x;
		let y;
		for(var i = 0; i < 15; i++) {
			x = Math.random() * (Main.layoutManager.primaryMonitor.width - 300);
			y = Math.random() * (Main.layoutManager.primaryMonitor.height - 100);
		
			let can = true;
			allNotes.forEach(function (n) {
				if( ( Math.abs(n._x - x) < 230) && ( Math.abs(n._y - y) < 100) ) {
					can = false;
				}
			});
			
			if ( can ) {
				return [x, y];
			}
		}
		return [x, y];
	},
	
	loadState: function () {
	
		let file2 = GLib.build_filenamev([PATH, '/' + this.id.toString() + '_state']);
		if (!GLib.file_test(file2, GLib.FileTest.EXISTS)) {
			let defaultPosition = this.computeRandomPosition();
			GLib.file_set_contents(
				file2,
				defaultPosition[0].toString() + ';' + defaultPosition[1].toString() + ';' + this.customColor + ';250;200;' + this._fontSize + ';true;'
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
	},
	
	saveState: function () {
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
	},
	
	createNote: function () {
		let nextId = allNotes.length;
		allNotes.push(new NoteBox(nextId, this.customColor, this._fontSize)); //FIXME
	},
	
	deleteNote: function () {
		this.destroy();
		refreshArray();
		saveAllNotes();
	},
	
	destroy: function () {
		this.actor.destroy_all_children();
		this.actor.destroy();
		this.actor = null;
	},
	
	show: function () {
		this.actor.visible = true;
		
		if (Z_POSITION == 'above-all') {
			Main.layoutManager.trackChrome(this.actor);
		}
	},
	
	hide: function () {
		this.onlyHide();
		this.onlySave();
	},
	
	onlyHide: function () {
		this.actor.visible = false;
		if (Z_POSITION == 'above-all') {
			Main.layoutManager.untrackChrome(this.actor);
		}
	},
	
	onlySave: function () {
		this.saveState();
		this.saveText();
	},
	
});

//------------------------------------------------

/*
 * This is the button in the top bar. It will trigger the showing/hiding of
 * notes, and if no note exists, it will create the first one.
 * The button can be hidden by some user settings, but still needs to be built
 * because it manages the loading.
 */
const NotesButton = new Lang.Class({
	Name:		'NotesButton',		// Class Name
	Extends:	PanelMenu.Button,	// Parent Class

	_init: function () {
		this.parent(0.0, 'NotesButton', true);
		let box = new St.BoxLayout();
		let icon = new St.Icon({ icon_name: 'document-edit-symbolic', style_class: 'system-status-icon'});

		box.add(icon);
		this.actor.add_child(box);
		this.update_icon_visibility();
		
		GLOBAL_ARE_VISIBLE = false;
	
		this.loadAllNotes();
		
		this.actor.connect('button-press-event', Lang.bind(this, this.toggleState));
		
		if(Convenience.getSettings().get_boolean('use-shortcut')) {
			this.USE_SHORTCUT = true;
			this._bindShortcut();
		} else {
			this.USE_SHORTCUT = false;
		}
	},
	
	update_icon_visibility: function () {
		if (Convenience.getSettings().get_boolean('hide-icon')) {
			this.actor.visible = false;
		} else {
			this.actor.visible = true;
		}
	},
	
	toggleState: function () {
		//log('toggleState');
		if(allNotes.length == 0) {
			this._createNote();
			this._showNotes();
		} else if (GLOBAL_ARE_VISIBLE) {
			this._hideNotes();
		} else {
			this._showNotes();
		}
	},
	
	loadAllNotes: function () {
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
	},
	
	_createNote: function () {
		let nextId = allNotes.length;
		allNotes.push(new NoteBox(nextId, '50,50,50', 16));
	},
	
	_showNotes: function () {
		GLOBAL_ARE_VISIBLE = true;
		
		if (Z_POSITION == 'special-layer') {
			Main.layoutManager.notesGroup.show();
		}
		
		allNotes.forEach(function (n) {
			n.show();
		});
	},
	
	_hideNotes: function () {
		if (Z_POSITION == 'special-layer') {
			Main.layoutManager.notesGroup.hide();
		}
		
		allNotes.forEach(function (n) {
			n.onlyHide();
		});
		allNotes.forEach(function (n) {
			n.onlySave();
		});
		
		GLOBAL_ARE_VISIBLE = false;
	},
	
	_onlyHideNotes: function () {
		allNotes.forEach(function (n) {
			n.onlyHide();
		});
		GLOBAL_ARE_VISIBLE = false;
	},
	
	_bindShortcut: function () {
		var ModeType = Shell.hasOwnProperty('ActionMode') ?
			Shell.ActionMode : Shell.KeyBindingMode;

		Main.wm.addKeybinding(
			'keyboard-shortcut',
			Convenience.getSettings(),
			Meta.KeyBindingFlags.NONE,
			ModeType.ALL,
			Lang.bind(this, this.toggleState)
		);
	},
});

//-------------------------------------------------------

function bringToPrimaryMonitorOnly() {
	allNotes.forEach(function (n) {
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
		globalButton._onlyHideNotes();
		return;
	}
	if (global.screen.get_workspace_by_index(global.screen.get_active_workspace_index()).list_windows() == '') {
		globalButton._showNotes();
	} else {
		globalButton._onlyHideNotes();
	}
}

function updateLayoutSetting() {
	allNotes.forEach(function (n) {
		n.remove_from_the_right_actor();
	});
	
	if (SIGNAUX.length != 0) {
		Main.overview.disconnect(SIGNAUX[0]);
		global.screen.disconnect(SIGNAUX[1]);
		global.window_manager.disconnect(SIGNAUX[2]);
		Main.overview.viewSelector._showAppsButton.disconnect(SIGNAUX[3]);
		Main.overview.viewSelector._text.disconnect(SIGNAUX[4]);
		global.screen.disconnect(SIGNAUX[5]);
	}
	
	SIGNAUX = [];
	
	Z_POSITION = SETTINGS.get_string('layout-position');
	
	if(Z_POSITION == 'in-overview') {
		SIGNAUX[0] = Main.overview.connect('showing', Lang.bind(this, updateVisibility));
		SIGNAUX[1] = global.screen.connect('notify::n-workspaces', Lang.bind(this, updateVisibility));
		SIGNAUX[2] = global.window_manager.connect('switch-workspace', Lang.bind(this, updateVisibility));
		SIGNAUX[3] = Main.overview.viewSelector._showAppsButton.connect('notify::checked', Lang.bind(this, updateVisibility));
		SIGNAUX[4] = Main.overview.viewSelector._text.connect('text-changed', Lang.bind(this, updateVisibility));
		SIGNAUX[5] = global.screen.connect('restacked', Lang.bind(this, updateVisibility));
	}
	
	allNotes.forEach(function (n) {
		n.load_in_the_right_actor();
	});
}

function hideNotesFromSpecialLayer(group, event) {
	// Don't close notes if the user is just hiding a note content
	if (event.get_button() != 3) {
		globalButton._hideNotes();
	}
}

//-------------------------------------------------

function enable() {
	SETTINGS = Convenience.getSettings();
	Z_POSITION = SETTINGS.get_string('layout-position');
	SIGNAL_LAYOUT = SETTINGS.connect('changed::layout-position', Lang.bind(this, updateLayoutSetting));
	SIGNAUX = [];
	
	if(Z_POSITION == 'in-overview') {
		SIGNAUX[0] = Main.overview.connect('showing', Lang.bind(this, updateVisibility));
		SIGNAUX[1] = global.screen.connect('notify::n-workspaces', Lang.bind(this, updateVisibility));
		SIGNAUX[2] = global.window_manager.connect('switch-workspace', Lang.bind(this, updateVisibility));
		SIGNAUX[3] = Main.overview.viewSelector._showAppsButton.connect('notify::checked', Lang.bind(this, updateVisibility));
		SIGNAUX[4] = Main.overview.viewSelector._text.connect('text-changed', Lang.bind(this, updateVisibility));
		SIGNAUX[5] = global.screen.connect('restacked', Lang.bind(this, updateVisibility));
	}
	
	allNotes = new Array();
	Main.layoutManager.notesGroup = new St.Widget({
		name: 'overviewGroup',
		visible: false,
		reactive: true,
		width: Main.layoutManager.primaryMonitor.width,
		height: Main.layoutManager.primaryMonitor.height,
		style_class: 'notesBackground'
	});
	Main.layoutManager.addChrome(Main.layoutManager.notesGroup);
	
	globalButton = new NotesButton();
//	about addToStatusArea :
//	- 0 is the position
//	- `right` is the box where we want our globalButton to be displayed (left/center/right)
	Main.panel.addToStatusArea('NotesButton', globalButton, 0, 'right');
	
	Main.layoutManager.notesGroup.connect('button-press-event', Lang.bind(this, hideNotesFromSpecialLayer));
	
	SIGNAL_BRING_BACK = SETTINGS.connect('changed::ugly-hack', Lang.bind(this, bringToPrimaryMonitorOnly));
	SIGNAL_ICON = SETTINGS.connect('changed::hide-icon', Lang.bind(this, globalButton.update_icon_visibility));
}

//--------------------------------

function disable() {
	allNotes.forEach(function (n) {
		n.onlySave();
		n.destroy();
	});
	
	if(globalButton.USE_SHORTCUT) {
		Main.wm.removeKeybinding('keyboard-shortcut');
	}
	
	if (SIGNAUX.length != 0) {
		Main.overview.disconnect(SIGNAUX[0]);
		global.screen.disconnect(SIGNAUX[1]);
		global.window_manager.disconnect(SIGNAUX[2]);
		Main.overview.viewSelector._showAppsButton.disconnect(SIGNAUX[3]);
		Main.overview.viewSelector._text.disconnect(SIGNAUX[4]);
		global.screen.disconnect(SIGNAUX[5]);
	}
	
	SETTINGS.disconnect(SIGNAL_LAYOUT);
	SETTINGS.disconnect(SIGNAL_BRING_BACK);
	SETTINGS.disconnect(SIGNAL_ICON);
	
	globalButton.destroy();
}

