
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const GLib = imports.gi.GLib;

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

const NotesPrefsPage = new Lang.Class({
	Name: "NotesPrefsPage",
	Extends: Gtk.ScrolledWindow,

	_init: function () {
		this.parent({
			vexpand: true,
			hscrollbar_policy: Gtk.PolicyType.NEVER,
			can_focus: true
		});
		
		this.stackpageMainBox = new Gtk.Box({
			visible: true,
			can_focus: false,
			margin_left: 40,
			margin_right: 40,
			margin_top: 12,
			margin_bottom: 12,
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 12
		});
		this.add(this.stackpageMainBox);
	},
	
	add_section: function(titre) {
		let section = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 6,
		});
		if (titre != "") {
			section.add(new Gtk.Label({
				label: '<b>' + titre + '</b>',
				halign: Gtk.Align.START,
				use_markup: true,
			}));
		}
	
		let a = new Gtk.ListBox({
			can_focus: false,
			has_focus: false,
			is_focus: false,
			has_default: false,
			selection_mode: Gtk.SelectionMode.NONE,
		});
		let frame = new Gtk.Frame();
		frame.add(a)
		section.add(frame);
		this.stackpageMainBox.add(section);
		return a;
	},

	add_row: function(filledbox, section) {
		let a = new Gtk.ListBoxRow({
			can_focus: false,
			has_focus: false,
			is_focus: false,
			has_default: false,
			selectable: false,
		});
		a.add(filledbox);
		section.add(a);
		return a;
	},
	
	add_widget: function(filledbox) {
		this.stackpageMainBox.add(filledbox);
	},
});

//-----------------------------------------------

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
		
		let settingsPage = this.add_page('settings', _("Settings"), true);
		
		let displaySection = settingsPage.add_section(_("Display"));
		let keybindingSection = settingsPage.add_section(_("Keybinding"));
		
		//---------------------------------------------------------------
		
		let labelPosition = new Gtk.Label({ label: _("Position of notes:"),
		                                             halign: Gtk.Align.START });
	
		let positionCombobox = new Gtk.ComboBoxText({
			visible: true,
			can_focus: true,
			halign: Gtk.Align.END,
			valign: Gtk.Align.CENTER
		});
	
		positionCombobox.append('special-layer', _("Above everything"));
		positionCombobox.append('on-background', _("On the background"));
		positionCombobox.append('above-all', _("Above all, without mask"));
	
		positionCombobox.active_id = SETTINGS.get_string('layout-position');
		
		positionCombobox.connect("changed", (widget) => {
			SETTINGS.set_string('layout-position', widget.get_active_id());
			if( (widget.get_active_id() == 'above-all') || (widget.get_active_id() == 'special-layer') ) {
				showSwitch.set_sensitive(false);
			} else {
				showSwitch.set_sensitive(true);
			}
		});
	
		let positionBox = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 15,
			margin: 6,
		});
		let positionBoxH = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
		});
		positionBoxH.pack_start(labelPosition, false, false, 0);
		positionBoxH.pack_end(positionCombobox, false, false, 0);
		
		let warning_label = new Gtk.Label({
			label: _("\"On the background\" is incompatible with the \'nautilus"+
			"-desktop\' Ubuntu component.\n\"Above all, without mask\" is "+
			"discouraged, since it makes it harder to resize or move your sticky notes."),
			halign: Gtk.Align.START,
			wrap: true,
		})
		warning_label.get_style_context().add_class('dim-label');
		
		positionBox.pack_start(positionBoxH, false, false, 0);
		positionBox.pack_end(warning_label, false, false, 0);
		
		//---------------------------------------------------------------
		
		let labelHide = new Gtk.Label({ label: _("Hide the icon"), halign: Gtk.Align.START });
		
		let hideSwitch = new Gtk.Switch();
		hideSwitch.set_state(false);
		hideSwitch.set_state(SETTINGS.get_boolean('hide-icon'));
		
		hideSwitch.connect('notify::active', Lang.bind(this, function(widget) {
			if (widget.active) {
				SETTINGS.set_boolean('hide-icon', true);
			} else {
				SETTINGS.set_boolean('hide-icon', false);
			}
		}));
		
		let hideBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		hideBox.pack_start(labelHide, false, false, 0);
		hideBox.pack_end(hideSwitch, false, false, 0);
		
		//---------------------------------------------------------------
		
		let keybindingBox = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 5,
			tooltip_text: _("Default value is") + " <Super>n"
		});
		
		let keybindingEntry = new Gtk.Entry({
			sensitive: SETTINGS.get_boolean('use-shortcut'),
			hexpand: true
		});
		
		if (SETTINGS.get_strv('keyboard-shortcut') != '') {
			keybindingEntry.text = SETTINGS.get_strv('keyboard-shortcut')[0];
		}
		
		let keybindingButton = new Gtk.Button({
			sensitive: SETTINGS.get_boolean('use-shortcut'),
			label: _("Apply")
		});
		
		keybindingButton.connect('clicked', Lang.bind(this, function(widget) {
			SETTINGS.set_strv('keyboard-shortcut', [keybindingEntry.text]);
		}));
		let keybindingBox1 = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			margin: 6,
		});
		keybindingBox1.get_style_context().add_class('linked');
		
		let labelKeybinding = new Gtk.Label({
			label: _("Use a keyboard shortcut to toggle notes"),
			halign: Gtk.Align.START
		});
		
		let keybindingSwitch = new Gtk.Switch();
		keybindingSwitch.set_state(true);
		keybindingSwitch.set_state(SETTINGS.get_boolean('use-shortcut'));
		
		keybindingSwitch.connect('notify::active', Lang.bind(this, function(widget) {
			if (widget.active) {
				SETTINGS.set_boolean('use-shortcut', true);
				keybindingEntry.sensitive = true;
				keybindingButton.sensitive = true;
				hideBox.sensitive = true;
			} else {
				SETTINGS.set_boolean('use-shortcut', false);
				keybindingEntry.sensitive = false;
				keybindingButton.sensitive = false;
				hideBox.sensitive = false;
			}
		}));
		
		let keybindingBox2 = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		keybindingBox2.pack_start(labelKeybinding, false, false, 0);
		keybindingBox2.pack_end(keybindingSwitch, false, false, 0);
		
		keybindingBox.pack_start(keybindingBox2, false, false, 0);
		keybindingBox1.pack_start(keybindingEntry, true, true, 0);
		keybindingBox1.pack_end(keybindingButton, false, false, 0);
		keybindingBox.pack_end(keybindingBox1, false, false, 0);

		//-----------------------------
		
		settingsPage.add_row(positionBox, displaySection);
		settingsPage.add_row(keybindingBox, keybindingSection);
		settingsPage.add_row(hideBox, keybindingSection);

		//-------------------------------
		
		this.build_help_page();
		this.build_about_page();
		
		//-------------------------------
		
		this.switcher.show_all();
	},

	add_page: function (id, title, will_use_classic_layout) {
		let page;
		if (will_use_classic_layout){
			page = new NotesPrefsPage();
		} else {
			page = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
		}
		this.add_titled(page, id, title);
		return page;
	},
	
	build_help_page: function() {
		let helpPage = this.add_page('help', _("Help"), false);
		let tabs = new Gtk.Notebook({ tab_pos: Gtk.PositionType.LEFT, expand: true, });
		helpPage.add(tabs);
		
		//-----------------------------

		let main_help_box = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			expand: true,
			margin: 15,
			spacing: 10
		});
		let main_help_label_1 = new Gtk.Label({ label:
			_("<b>Show/hide all notes:</b> click on the icon in the GNOME Shell top bar."),
			halign: Gtk.Align.START, wrap: true, use_markup: true });
		let main_help_label_2 = new Gtk.Label({ label:
			_("<b>Create a note:</b> click on the \"+\" button at the left of a " +
			"note header, it will create a new note, with the same color and the " +
			"same font size as the note you clicked on."),
			halign: Gtk.Align.START, wrap: true, use_markup: true });
		let main_help_label_3 = new Gtk.Label({ label:
			_("<b>Move a note:</b> drag the blank space in the center of the note header."),
			halign: Gtk.Align.START, wrap: true, use_markup: true });
		let main_help_label_4 = new Gtk.Label({ label:
			_("<b>Resize a note:</b> drag the resize button at the right of the note header."),
			halign: Gtk.Align.START, wrap: true, use_markup: true });
		let main_help_label_5 = new Gtk.Label({ label:
			_("<b>Change color:</b> click on the menu button, and select a color."),
			halign: Gtk.Align.START, wrap: true, use_markup: true });
		let main_help_label_6 = new Gtk.Label({ label:
			_("<b>Change font size:</b> click on the menu button, and increase " +
			"or decrease the font size with \"+\" and \"-\" buttons."),
			halign: Gtk.Align.START, wrap: true, use_markup: true });
		let main_help_label_7 = new Gtk.Label({ label:
			_("<b>Delete a note:</b> click on the wastebasket icon and confirm."),
			halign: Gtk.Align.START, wrap: true, use_markup: true });
		
		let help_image_1 = new Gtk.Image({
			pixbuf: GdkPixbuf.Pixbuf.new_from_file_at_size(
			                Me.path+'/screenshots/help_picture_1.png', 265, 164)
		});
		let help_image_2 = new Gtk.Image({
			pixbuf: GdkPixbuf.Pixbuf.new_from_file_at_size(
			                Me.path+'/screenshots/help_picture_2.png', 383, 233)
		});
		
		main_help_box.add(main_help_label_1);
		main_help_box.add(main_help_label_2);
		main_help_box.add(help_image_1);
		main_help_box.add(main_help_label_3);
		main_help_box.add(main_help_label_4);
		main_help_box.add(main_help_label_5);
		main_help_box.add(help_image_2);
		main_help_box.add(main_help_label_6);
		main_help_box.add(main_help_label_7);
		let scrolled = new Gtk.ScrolledWindow();
		scrolled.add(main_help_box);
		tabs.append_page(scrolled, new Gtk.Label({ label: _("Using the extension"), }))
		
		let data_box = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			expand: true,
			margin: 20,
			spacing: 18
		});
		let data_label_1 = new Gtk.Label({
			label: _("Your notes are saved to the disk on various occasions (mainly when you hide them). "+
			"If you want to <b>get a copy of your notes</b>, this button opens the folder where they are."),
			halign: Gtk.Align.START,
			wrap: true,
			use_markup: true,
		});
		let data_label_2 = new Gtk.Label({
			label: _("<i>Files ending with \"_state\" contain the color and position of your notes</i>\n\n"+
			"<i>Files ending with \"_text\" contain the text written in your notes</i>"),
			halign: Gtk.Align.START,
			wrap: true,
			use_markup: true,
		});
		
		let data_button = new Gtk.Button({ label: _("Open the storage directory") });
		data_button.connect('clicked', Lang.bind(this, function(widget) {
			GLib.spawn_command_line_async('xdg-open .local/share/notes@maestroschan.fr');
		}));
		data_button.get_style_context().add_class('suggested-action');
		
		data_box.add(data_label_1);
		data_box.add(data_button);
		data_box.add(data_label_2);
		tabs.append_page(data_box, new Gtk.Label({ label: _("Backup your notes"), }))
		
		let reset_box = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			expand: true,
			margin: 20,
			spacing: 18
		});
		let reset_label = new Gtk.Label({ label: _(
			"Click on this button if you accidentally moved a note out of your primary monitor\n"+
			"(example: if you had notes on a secondary monitor and unplugged it)."
		), halign: Gtk.Align.START, wrap: true, use_markup: true });
		let reset_button = new Gtk.Button({ label: _("Bring back all notes to the primary monitor") });
		reset_button.connect('clicked', Lang.bind(this, function(widget) {
			SETTINGS.set_boolean('ugly-hack', !SETTINGS.get_boolean('ugly-hack'));
		}));
		reset_box.add(reset_label);
		reset_box.add(reset_button);
		tabs.append_page(reset_box, new Gtk.Label({ label: _("Lost some notes?"), }))
	},
	
	build_about_page: function() {
		let aboutPage = this.add_page('about', _("About"), false);
		aboutPage.set_border_width(20);
		aboutPage.set_spacing(8);

		let a_name = '<b>' + Me.metadata.name.toString() + '</b> (v';
		a_name = a_name +  + Me.metadata.version.toString() + ')';
		let a_uuid = Me.metadata.uuid.toString();
		let a_description = _(Me.metadata.description.toString());
		
		let label_name = new Gtk.Label({
			label: a_name,
			use_markup: true,
			halign: Gtk.Align.CENTER
		});
		let a_image = new Gtk.Image({
			pixbuf: GdkPixbuf.Pixbuf.new_from_file_at_size(
			                 Me.path+'/screenshots/about_picture.png', 326, 228)
		});
		let label_description = new Gtk.Label({ label: a_description, wrap: true,
		                                            halign: Gtk.Align.CENTER });
		
		let contrib_string = _("Author:") + ' ' + 'Romain F.T.';
		if (_("translator-credits") != "translator-credits") {
			contrib_string += '\n' + _("Translator:") + ' ' + _("translator-credits");
		}
		let label_contributors = new Gtk.Label({
			label: contrib_string,
			wrap: true,
			halign: Gtk.Align.CENTER
		});
		
		let url_button = new Gtk.LinkButton({
			label: _("Report bugs or ideas"),
			uri: Me.metadata.url.toString()
		});
		
		aboutPage.pack_start(label_name, false, false, 0);
		aboutPage.pack_start(a_image, false, false, 0);
		aboutPage.pack_start(label_description, false, false, 0);
		aboutPage.pack_start(label_contributors, false, false, 0);
		aboutPage.pack_start(url_button, false, false, 0);
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

//-----------------------------------------------
