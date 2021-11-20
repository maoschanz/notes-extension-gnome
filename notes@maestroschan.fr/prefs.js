// notes@maestroschan.fr/prefs.js
// GPL v3
// Copyright 2018-2021 Romain F. T.

const{ GObject, Gtk, Gdk, GdkPixbuf, GLib } = imports.gi;
const Mainloop = imports.mainloop;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function init() {
	ExtensionUtils.initTranslations();
}

let SETTINGS = ExtensionUtils.getSettings();

//------------------------------------------------------------------------------

const NotesSettingsWidget = new GObject.Class({
	Name: 'NotesSettingsWidget',
	GTypeName: 'NotesSettingsWidget',

	_init () {
		let builder = new Gtk.Builder();
		builder.add_from_file(Me.path+'/prefs.ui');
		this.prefs_stack = builder.get_object('prefs_stack');

		this.switcher = new Gtk.StackSwitcher({
			halign: Gtk.Align.CENTER,
			visible: true,
			stack: this.prefs_stack
		});

		this._buildSettingsPage(builder);
		this._buildHelpPage(builder);
		this._buildAboutPage(builder);

		this.switcher.show_all();
	},

	//--------------------------------------------------------------------------

	_buildSettingsPage (builder) {
		let RELOAD_TEXT = _("Modifications will be effective after reloading the extension.");

		// Position of the notes (layer)
		let radioBtn1 = builder.get_object('radio1');
		let radioBtn2 = builder.get_object('radio2');
		let radioBtn3 = builder.get_object('radio3');
		switch (SETTINGS.get_string('layout-position')) {
			case 'above-all':
				radioBtn1.set_active(true);
			break;
			case 'on-background':
				radioBtn2.set_active(true);
			break;
			case 'cycle-layers':
				radioBtn3.set_active(true);
			break;
			default: break;
		}
		this._connectRadioBtn('above-all', radioBtn1);
		this._connectRadioBtn('on-background', radioBtn2);
		this._connectRadioBtn('cycle-layers', radioBtn3);

		//----------------------------------------------------------------------

		let focus_switch = builder.get_object('focus_switch');
		focus_switch.set_state(SETTINGS.get_boolean('auto-focus'));
		focus_switch.connect('notify::active', (widget) => {
			SETTINGS.set_boolean('auto-focus', widget.active);
		});

		//----------------------------------------------------------------------

		// The "hide icon" switch has to be build before the keybinding switch
		this._hide_switch = builder.get_object('hide_switch');
		this._hide_switch.set_state(SETTINGS.get_boolean('hide-icon'));
		this._hide_switch.connect('notify::active', (widget) => {
			SETTINGS.set_boolean('hide-icon', widget.active);
		});

		//----------------------------------------------------------------------

		// Context: %s will be replaced with the default keyboard shortcut
		let default_kbs_label = _("Default value is %s");
		default_kbs_label = default_kbs_label.replace('%s', "<Super><Alt>n");

		// Text entry
		let keybinding_entry = builder.get_object('keybinding_entry');
		keybinding_entry.set_sensitive(SETTINGS.get_boolean('use-shortcut'));
		keybinding_entry.set_tooltip_text(default_kbs_label);

		builder.get_object('default-kbs-help-1').set_label(default_kbs_label);
		builder.get_object('default-kbs-help-2').set_label(RELOAD_TEXT);

		if (SETTINGS.get_strv('notes-kb-shortcut') != '') {
			keybinding_entry.text = SETTINGS.get_strv('notes-kb-shortcut')[0];
		}

		// "Apply" button
		let keybinding_button = builder.get_object('keybinding_button');
		keybinding_button.set_sensitive(SETTINGS.get_boolean('use-shortcut'));

		keybinding_button.connect('clicked', (widget) => {
			SETTINGS.set_strv('notes-kb-shortcut', [keybinding_entry.text]);
		});

		// "Enable shortcut" switch
		let keybinding_switch = builder.get_object('keybinding_switch');
		keybinding_switch.set_state(SETTINGS.get_boolean('use-shortcut'));

		keybinding_switch.connect('notify::active', (widget) => {
			SETTINGS.set_boolean('use-shortcut', widget.active);
			keybinding_entry.sensitive = widget.active;
			keybinding_button.sensitive = widget.active;
			this._hide_switch.sensitive = widget.active;
		});

		//----------------------------------------------------------------------

		// The default color of the very first note
		let color_btn = builder.get_object('default_rgb_btn');
		let colorArray = SETTINGS.get_strv('first-note-rgb');
		let rgba = new Gdk.RGBA();
		rgba.red = parseFloat(colorArray[0]);
		rgba.green = parseFloat(colorArray[1]);
		rgba.blue = parseFloat(colorArray[2]);
		rgba.alpha = 1.0;
		color_btn.set_rgba(rgba);

		color_btn.connect('color-set', (widget) => {
			rgba = widget.get_rgba();
			SETTINGS.set_strv('first-note-rgb', [
				rgba.red.toString(),
				rgba.green.toString(),
				rgba.blue.toString()
			]);
		});
	},

	_connectRadioBtn(strId, widget) {
		widget.connect('toggled', (widget) => {
			SETTINGS.set_string('layout-position', strId);
		});
	},

	//--------------------------------------------------------------------------

	_buildHelpPage(builder) {
		builder.get_object('image1').set_from_pixbuf(
			GdkPixbuf.Pixbuf.new_from_file_at_size(
			              Me.path + '/screenshots/help_picture_1.png', 265, 164)
		);
		builder.get_object('image2').set_from_pixbuf(
			GdkPixbuf.Pixbuf.new_from_file_at_size(
			              Me.path + '/screenshots/help_picture_2.png', 380, 300)
		);

		let data_button = builder.get_object('backup_btn');
		data_button.connect('clicked', (widget) => {
			let datadir = GLib.build_pathv('/', [GLib.get_user_data_dir(), 'notes@maestroschan.fr']);
			GLib.spawn_command_line_async('xdg-open ' + datadir);
		});

		let reset_button = builder.get_object('reset_btn');
		reset_button.connect('clicked', (widget) => {
			SETTINGS.set_boolean('ugly-hack', !SETTINGS.get_boolean('ugly-hack'));
		});
	},

	//--------------------------------------------------------------------------

	_buildAboutPage(builder) {
		builder.get_object('about_icon').set_from_pixbuf(
			GdkPixbuf.Pixbuf.new_from_file_at_size(Me.path +
			                         '/screenshots/about_picture.png', 163, 114)
		//	                         '/screenshots/about_picture.png', 326, 228)
		);

		let ext_version = _("Version %s").replace('%s', Me.metadata.version.toString());
		builder.get_object('label_version').set_label(ext_version)

		// TODO why tf does that crash?
		// let gs_versions = Me.metadata['shell-version'][0].toString().replace(',', ", ");
		// let versions_str = _("Compatible with GNOME Shell %s").replace('%s', gs_versions);
		// builder.get_object('label_gs_versions').set_label(versions_str)

		let translation_credits = builder.get_object('translation_credits').get_label();
		if (translation_credits == 'translator-credits') {
			builder.get_object('translation_label').set_label('');
			builder.get_object('translation_credits').set_label('');
		}

		let linkBox = builder.get_object('link_box');
		let url_button1 = new Gtk.LinkButton({
			label: _("Report bugs or ideas"),
			uri: Me.metadata.url.toString()
		});
		linkBox.pack_start(url_button1, false, false, 0);
	}

});

//------------------------------------------------------------------------------

// I guess this is like the "enable" in extension.js : something called each
// time he user try to access the settings' window
function buildPrefsWidget() {
	let widget = new NotesSettingsWidget();
	Mainloop.timeout_add(0, () => {
		let headerBar = widget.prefs_stack.get_toplevel().get_titlebar();
		headerBar.custom_title = widget.switcher;
		return false;
	});
	widget.prefs_stack.show_all();
	return widget.prefs_stack;
}

//------------------------------------------------------------------------------

