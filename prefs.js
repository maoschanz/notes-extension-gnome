
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
//const Util = imports.misc.util;
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

const PrefsPage = new Lang.Class({
	Name: "PrefsPage",
	Extends: Gtk.ScrolledWindow,

	_init: function () {
		this.parent({
			vexpand: true,
			can_focus: true
		});
		
		this.stackpageMainBox = new Gtk.Box({
			visible: true,
			can_focus: false,
			margin_left: 50,
			margin_right: 50,
			margin_top: 20,
			margin_bottom: 20,
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 18
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
		section.add(a);
		this.stackpageMainBox.add(section);
		return a;
	},

	add_row: function(filledbox, section) {
		let a = new Gtk.ListBoxRow({
			can_focus: false,
			has_focus: false,
			is_focus: false,
			has_default: false,
//			activatable: false,
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
		
		this.settingsPage = this.add_page('settings', _("Settings"));

		let displaySection = this.settingsPage.add_section(_("Display"));
		let keybindingSection = this.settingsPage.add_section(_("Keybinding"));
		
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
		positionCombobox.append('in-overview', _("Empty Overview"));
	
		positionCombobox.active_id = SETTINGS.get_string('layout-position');
		
		positionCombobox.connect("changed", (widget) => {
			SETTINGS.set_string('layout-position', widget.get_active_id());
			if( widget.get_active_id() == 'above-all') {
				showSwitch.set_sensitive(false);
			} else {
				showSwitch.set_sensitive(true);
			}
		});
	
		let positionBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		positionBox.pack_start(new Gtk.Label({ label: labelPosition, halign: Gtk.Align.START }), false, false, 0);
		positionBox.pack_end(positionCombobox, false, false, 0);
		
		//---------------------------------------------------------------
		
		let labelShow = _("Always show notes");
		
		let showSwitch = new Gtk.Switch();
		showSwitch.set_state(false);
		showSwitch.set_state(SETTINGS.get_boolean('always-show'));
		
		showSwitch.connect('notify::active', Lang.bind(this, function(widget) {
			if (widget.active) {
				SETTINGS.set_boolean('always-show', true);				
			} else {
				SETTINGS.set_boolean('always-show', false);
			}
		}));
		
		let showBox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		showBox.pack_start(new Gtk.Label({ label: labelShow, halign: Gtk.Align.START }), false, false, 0);
		showBox.pack_end(showSwitch, false, false, 0);
		
		//---------------------------------------------------------------
		
		let keybindingBox = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 5,
			tooltip_text: _("Default value is") + " <Super>n"
		});
		
		let keybindingEntry = new Gtk.Entry({
//			sensitive: false,
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
		let keybindingBox1 = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		
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
		
		let keybindingBox2 = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 15,
			margin: 6,
		});
		keybindingBox2.pack_start(new Gtk.Label({ label: labelKeybinding, halign: Gtk.Align.START }), false, false, 0);
		keybindingBox2.pack_end(keybindingSwitch, false, false, 0);
		
		keybindingBox.pack_start(keybindingBox2, false, false, 0);
		keybindingBox1.pack_start(keybindingEntry, true, true, 0);
		keybindingBox1.pack_end(keybindingButton, false, false, 0);
		keybindingBox.pack_end(keybindingBox1, false, false, 0);

		//-----------------------------
		
		this.settingsPage.add_row(positionBox, displaySection);
//		this.settingsPage.add_row(showBox, displaySection);
		this.settingsPage.add_row(keybindingBox, keybindingSection);

		//-------------------------------

		this.helpPage = this.add_page('help', _("Help"));

		reset_button = new Gtk.Button({ label: _("Bring back all notes to the primary monitor") });
		reset_button.connect('clicked', Lang.bind(this, function(widget) {
			SETTINGS.set_boolean('ugly-hack', !SETTINGS.get_boolean('ugly-hack'));
		}));
		this.helpPage.stackpageMainBox.add(reset_button);
		
		data_button = new Gtk.Button({ label: _("Open the storage directory") });
		data_button.connect('clicked', Lang.bind(this, function(widget) {
			GLib.spawn_command_line_async('xdg-open .local/share/notes@maestroschan.fr');
//			Util.trySpawnCommandLine('xdg-open ~/.local/share/notes@maestroschan.fr');
		}));
		this.helpPage.stackpageMainBox.add(data_button);
		
		//-------------------------------

		this.aboutPage = this.add_page('about', _("About"));

		let a_name = '<b>' + Me.metadata.name.toString() + '</b>';
		let a_uuid = Me.metadata.uuid.toString();
		let a_description = _(Me.metadata.description.toString());
		
		let label_name = new Gtk.Label({ label: a_name, use_markup: true, halign: Gtk.Align.CENTER });
		let a_image = new Gtk.Image({ pixbuf: GdkPixbuf.Pixbuf.new_from_file_at_size(Me.path+'/about_picture.png', 399, 228) });
		let label_description = new Gtk.Label({ label: a_description, wrap: true, halign: Gtk.Align.CENTER });
		
//		let label_contributors = new Gtk.Label({
//			label: "Author: roschan.",
//			wrap: true,
//			halign: Gtk.Align.CENTER
//		});
		
		let about_box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10});
		about_box.pack_start(label_name, false, false, 0);
		about_box.pack_start(a_image, false, false, 0);
		about_box.pack_start(label_description, false, false, 0);
//		about_box.pack_start(label_contributors, false, false, 0);

		this.aboutPage.add_widget(about_box);
		
//		this.aboutPage.add_widget(); //TODO lien vers les notes ??

		let LinkBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
		let a_version = ' (v' + Me.metadata.version.toString() + ') ';
		
		let url_button = new Gtk.LinkButton({
			label: _("Report bugs or ideas"),
			uri: Me.metadata.url.toString()
		});
		
		LinkBox.pack_start(url_button, false, false, 0);
		LinkBox.pack_end(new Gtk.Label({ label: a_version, halign: Gtk.Align.START }), false, false, 0);
		
		this.aboutPage.stackpageMainBox.pack_end(LinkBox, false, false, 0);
		
		//-------------------------------

		this.switcher.show_all();
	},

	add_page: function (id, title) {
		let page = new PrefsPage();
		this.add_titled(page, id, title);
		return page;
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







