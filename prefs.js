
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

//-----------------------------------------------

function init() {
	Convenience.initTranslations();
}

let SETTINGS = Convenience.getSettings();

//-----------------------------------------------

var PrefsPage = new Lang.Class({
	Name: "PrefsPage",
	Extends: Gtk.ScrolledWindow,

	_init: function () {
		this.parent({
			vexpand: true,
			can_focus: true
		});
		
		this.box = new Gtk.Box({
			visible: true,
			can_focus: false,
			margin_left: 80,
			margin_right: 80,
			margin_top: 20,
			margin_bottom: 20,
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 20
		});
		this.add(this.box);
	},

	add_widget: function(filledbox) {
		this.box.add(filledbox);
	} 
});

const NotesSettingsWidget = new GObject.Class({
	Name: 'NotesSettingsWidget',
	GTypeName: 'NotesSettingsWidget',
	Extends: Gtk.Stack,

	_init: function () {
		this.parent({transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT});
		
		this.switcher = new Gtk.StackSwitcher({
			halign: Gtk.Align.CENTER,
			stack: this
		});
		
		//---------------------------------------------------------------
		
		this.generalPage = this.add_page('general', _("General"));

		//---------------------------------------------------------------
		
		let labelPosition = _("Position of notes:");
	
		let positionCombobox = new Gtk.ComboBoxText({
			visible: true,
			can_focus: true,
			halign: Gtk.Align.END,
			valign: Gtk.Align.CENTER
		});
	
		positionCombobox.append('above-all', _("Above everything"));
		positionCombobox.append('on-background', _("On the background"));
	
		positionCombobox.active_id = SETTINGS.get_string('layout-position');
		
		positionCombobox.connect("changed", (widget) => {
			SETTINGS.set_string('layout-position', widget.get_active_id());
		});
	
		let positionBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10});
		positionBox.pack_start(new Gtk.Label({ label: labelPosition, halign: Gtk.Align.START }), false, false, 0);
		positionBox.pack_end(positionCombobox, false, false, 0);
		
		//---------------------------------------------------------------
		
		let keybindingBox = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 0,
			tooltip_text: _("Default value is") + " <Super>n"
		});
		
		let keybindingEntry = new Gtk.Entry({
			sensitive: false,
			sensitive: SETTINGS.get_boolean('use-shortcut'),
			hexpand: true
		});
		
		if (SETTINGS.get_strv('keyboard-shortcut') != '') {
			keybindingEntry.text = SETTINGS.get_strv('keyboard-shortcut')[0];
		}
		
		let keybindingButton = new Gtk.Button({ sensitive: SETTINGS.get_boolean('use-shortcut'), label: _("Apply") });
		
		keybindingButton.connect('clicked', Lang.bind(this, function(widget) {
			SETTINGS.set_strv('keyboard-shortcut', [keybindingEntry.text]);
		}));
		let keybindingBox1 = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
		
		let labelKeybinding = _("Use a keyboard shortcut to toggle notes");
		
		let keybindingSwitch = new Gtk.Switch();
		keybindingSwitch.set_state(true);
		keybindingSwitch.set_state(SETTINGS.get_boolean('use-shortcut'));
		
		keybindingSwitch.connect('notify::active', Lang.bind(this, function(widget) {
			if (widget.active) {
				SETTINGS.set_boolean('use-shortcut', true);
				keybindingEntry.sensitive = true;
				keybindingButton.sensitive = true;
				
			} else {
				SETTINGS.set_boolean('use-shortcut', false);
				keybindingEntry.sensitive = false;
				keybindingButton.sensitive = false;
			}
		}));
		
		let keybindingBox2 = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
		keybindingBox2.pack_start(new Gtk.Label({ label: labelKeybinding, halign: Gtk.Align.START }), false, false, 0);
		keybindingBox2.pack_end(keybindingSwitch, false, false, 0);
		
		keybindingBox.pack_start(keybindingBox2, false, false, 0);
		keybindingBox1.pack_start(keybindingEntry, true, true, 0);
		keybindingBox1.pack_end(keybindingButton, false, false, 0);
		keybindingBox.pack_end(keybindingBox1, false, false, 0);

		this.generalPage.add_widget(positionBox);
		this.generalPage.add_widget(keybindingBox);
//		this.generalPage.add_widget(); //lien vers les notes

		//------------------

//		this.appearancePage = this.add_page('appearance', _("Appearance"));
		
		//-----------------------------
		
		let labelColor = _("Default note color:");
		
		this.colorButton = new Gtk.ColorButton();
		this.colorButton.set_use_alpha(false);
		this.colorButton.connect('notify::color', Lang.bind(this, this._onColorChanged));
		
		let rgba = new Gdk.RGBA();
		let hexString = SETTINGS.get_string("default-color");
		rgba.parse(hexString);
		
		this.colorButton.set_rgba(rgba);
		
		let colorBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
		colorBox.pack_start(new Gtk.Label({ label: labelColor, halign: Gtk.Align.START }), false, false, 0);
		colorBox.pack_end(this.colorButton, false, false, 0);
		
		//-----------------------------
		
		let labelFontSize = _("Default font size:");
		
		let fontSize = new Gtk.SpinButton();
		fontSize.set_sensitive(true);
		fontSize.set_range(0, 40);
		fontSize.set_value(13);
		fontSize.set_value(SETTINGS.get_int('font-size'));
		fontSize.set_increments(1, 2);
		
		fontSize.connect('value-changed', Lang.bind(this, function(w){
			var value = w.get_value_as_int();
			SETTINGS.set_int('font-size', value);
		}));
		
		let fontSizeBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
		fontSizeBox.pack_start(new Gtk.Label({ label: labelFontSize, halign: Gtk.Align.START }), false, false, 0);
		fontSizeBox.pack_end(fontSize, false, false, 0);

		//-----------------------------
		
//		let labelNoteSize = _("Default note size:");
//		
//		let widthSize = new Gtk.SpinButton();
//		widthSize.set_sensitive(true);
//		widthSize.set_range(280, 500);
//		widthSize.set_value(300);
//		widthSize.set_value(SETTINGS.get_int('default-width'));
//		widthSize.set_increments(1, 2);		
//		widthSize.connect('value-changed', Lang.bind(this, function(w){
//			var value = w.get_value_as_int();
//			SETTINGS.set_int('default-width', value);
//		}));
//		
//		let heightSize = new Gtk.SpinButton();
//		heightSize.set_sensitive(true);
//		heightSize.set_range(90, 400);
//		heightSize.set_value(200);
//		heightSize.set_value(SETTINGS.get_int('default-height'));
//		heightSize.set_increments(1, 2);
//		heightSize.connect('value-changed', Lang.bind(this, function(w){
//			var value = w.get_value_as_int();
//			SETTINGS.set_int('default-height', value);
//		}));
//		
//		let noteSizeBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
//		noteSizeBox.pack_start(new Gtk.Label({ label: labelNoteSize, halign: Gtk.Align.START }), false, false, 0);
//		noteSizeBox.pack_end(widthSize, false, false, 0);
//		noteSizeBox.pack_end(heightSize, false, false, 0);

		//-----------------------------
		
//		let labelNotePosition = _("Default note position:");
//		
//		let xPosition = new Gtk.SpinButton();
//		xPosition.set_sensitive(true);
//		xPosition.set_range(50, 800);
//		xPosition.set_value(200);
//		xPosition.set_value(SETTINGS.get_int('default-x'));
//		xPosition.set_increments(1, 10);		
//		xPosition.connect('value-changed', Lang.bind(this, function(w){
//			var value = w.get_value_as_int();
//			SETTINGS.set_int('default-x', value);
//		}));
//		
//		let yPosition = new Gtk.SpinButton();
//		yPosition.set_sensitive(true);
//		yPosition.set_range(50, 600);
//		yPosition.set_value(150);
//		yPosition.set_value(SETTINGS.get_int('default-y'));
//		yPosition.set_increments(1, 10);
//		yPosition.connect('value-changed', Lang.bind(this, function(w){
//			var value = w.get_value_as_int();
//			SETTINGS.set_int('default-y', value);
//		}));
//		
//		let notePositionBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
//		notePositionBox.pack_start(new Gtk.Label({ label: labelNotePosition, halign: Gtk.Align.START }), false, false, 0);
//		notePositionBox.pack_end(xPosition, false, false, 0);
//		notePositionBox.pack_end(yPosition, false, false, 0);

		//-----------------------------
		
//		this.appearancePage.add_widget(fontSizeBox);
//		this.appearancePage.add_widget(colorBox);
//		this.appearancePage.add_widget(noteSizeBox);
//		this.appearancePage.add_widget(notePositionBox);
		
		this.generalPage.add_widget(fontSizeBox);
		this.generalPage.add_widget(colorBox);

		//-------------------------------

		this.aboutPage = this.add_page('about', _("About"));

		let a_name = '<b>' + Me.metadata.name.toString() + '</b>';
		let a_uuid = Me.metadata.uuid.toString();
		let a_version = 'version ' + Me.metadata.version.toString();
		let a_description = _(Me.metadata.description.toString());
		
		let label_name = new Gtk.Label({ label: a_name, use_markup: true, halign: Gtk.Align.CENTER });
		
		let url_button = new Gtk.LinkButton({ label: a_uuid, uri: Me.metadata.url.toString() });
		
		let a_image = new Gtk.Image({ pixbuf: GdkPixbuf.Pixbuf.new_from_file_at_size(Me.path+'/about_picture.png', 399, 228) });
		
		let label_version = new Gtk.Label({ label: a_version, use_markup: true, halign: Gtk.Align.CENTER });
		let label_description = new Gtk.Label({ label: a_description, wrap: true, halign: Gtk.Align.CENTER });
		
//		let label_contributors = new Gtk.Label({
//			label: "Author: roschan.",
//			wrap: true,
//			halign: Gtk.Align.CENTER
//		});
		
		let about_box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10});
		about_box.pack_start(label_name, false, false, 0);
		about_box.pack_start(label_version, false, false, 0);
		about_box.pack_start(a_image, false, false, 0);
		about_box.pack_start(label_description, false, false, 0);
//		about_box.pack_start(label_contributors, false, false, 0);
		about_box.pack_start(url_button, false, false, 0);

		this.aboutPage.add_widget(about_box);

		//-------------------------------

		this.switcher.show_all();
	},

	add_page: function (id, title) {
		let page = new PrefsPage();
		this.add_titled(page, id, title);
		return page;
	},
	
	_onColorChanged: function() {
		let rgb = this.colorButton.get_rgba().to_string(); //'rgb(r,g,b)'
		SETTINGS.set_string("default-color", rgb);
	},
});

//-----------------------------------------------

//I guess this is like the "enable" in extension.js : something called each
//time he user try to access the settings' window
function buildPrefsWidget() {
	let widget = new NotesSettingsWidget();

	Mainloop.timeout_add(0, () => {
		let headerBar = widget.get_toplevel().get_titlebar();
		headerBar.custom_title = widget.switcher;
		return false;
	});

	widget.show_all();

	return widget;
}







