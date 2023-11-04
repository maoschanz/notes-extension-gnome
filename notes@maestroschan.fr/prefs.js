// notes@maestroschan.fr/prefs.js
// GPL v3
// Copyright 2018-2021 Romain F. T.

import GObject from 'gi://GObject';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

//------------------------------------------------------------------------------

const NotesSettingsWidget = new GObject.Class({
	Name: 'NotesSettingsWidget',
	GTypeName: 'NotesSettingsWidget',

	_init (extension) {
		this._extension = extension;
		this._settings = this._extension.getSettings();
		this._path = this._extension.path;

		let builder = new Gtk.Builder();
		builder.add_from_file(this._path+'/prefs.ui');
		this.prefs_stack = builder.get_object('prefs_stack');

		this._buildSettingsPage(builder);
		this._buildHelpPage(builder);
		this._buildAboutPage(builder);
	},

	//--------------------------------------------------------------------------

	_buildSettingsPage (builder) {
		let RELOAD_TEXT = _("Modifications will be effective after reloading the extension.");

		// Position of the notes (layer)
		let radioBtn1 = builder.get_object('radio1');
		let radioBtn2 = builder.get_object('radio2');
		let radioBtn3 = builder.get_object('radio3');
		switch (this._settings.get_string('layout-position')) {
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
		focus_switch.set_state(this._settings.get_boolean('auto-focus'));
		focus_switch.connect('notify::active', (widget) => {
			this._settings.set_boolean('auto-focus', widget.active);
		});

		//----------------------------------------------------------------------

		// The "hide icon" switch has to be build before the keybinding switch
		this._hide_switch = builder.get_object('hide_switch');
		this._hide_switch.set_state(this._settings.get_boolean('hide-icon'));
		this._hide_switch.connect('notify::active', (widget) => {
			this._settings.set_boolean('hide-icon', widget.active);
		});

		//----------------------------------------------------------------------

		// Context: %s will be replaced with the default keyboard shortcut
		let default_kbs_label = _("Default value is %s");
		default_kbs_label = default_kbs_label.replace('%s', "<Super><Alt>n");

		// Text entry
		let keybinding_entry = builder.get_object('keybinding_entry');
		keybinding_entry.set_sensitive(this._settings.get_boolean('use-shortcut'));
		keybinding_entry.set_tooltip_text(default_kbs_label);

		builder.get_object('default-kbs-help-1').set_label(default_kbs_label);
		builder.get_object('default-kbs-help-2').set_label(RELOAD_TEXT);

		if (this._settings.get_strv('notes-kb-shortcut') != '') {
			keybinding_entry.text = this._settings.get_strv('notes-kb-shortcut')[0];
		}

		// "Apply" button
		let keybinding_button = builder.get_object('keybinding_button');
		keybinding_button.set_sensitive(this._settings.get_boolean('use-shortcut'));

		keybinding_button.connect('clicked', (widget) => {
			this._settings.set_strv('notes-kb-shortcut', [keybinding_entry.text]);
		});

		// "Enable shortcut" switch
		let keybinding_switch = builder.get_object('keybinding_switch');
		keybinding_switch.set_state(this._settings.get_boolean('use-shortcut'));

		keybinding_switch.connect('notify::active', (widget) => {
			this._settings.set_boolean('use-shortcut', widget.active);
			keybinding_entry.sensitive = widget.active;
			keybinding_button.sensitive = widget.active;
			this._hide_switch.sensitive = widget.active;
		});

		//----------------------------------------------------------------------

		// The default color of the very first note
		let color_btn = builder.get_object('default_rgb_btn');
		let colorArray = this._settings.get_strv('first-note-rgb');
		let rgba = new Gdk.RGBA();
		rgba.red = parseFloat(colorArray[0]);
		rgba.green = parseFloat(colorArray[1]);
		rgba.blue = parseFloat(colorArray[2]);
		rgba.alpha = 1.0;
		color_btn.set_rgba(rgba);

		color_btn.connect('color-set', (widget) => {
			rgba = widget.get_rgba();
			this._settings.set_strv('first-note-rgb', [
				rgba.red.toString(),
				rgba.green.toString(),
				rgba.blue.toString()
			]);
		});
	},

	_connectRadioBtn(strId, widget) {
		widget.connect('toggled', (widget) => {
			this._settings.set_string('layout-position', strId);
		});
	},

	//--------------------------------------------------------------------------

	_buildHelpPage(builder) {
		let help_url = this._extension.metadata.url.toString();
		help_url += "/blob/master/user-help/README.md";
		builder.get_object('help_btn').set_uri(help_url);

		let data_button = builder.get_object('backup_btn');
		data_button.connect('clicked', (widget) => {
			let datadir = GLib.build_pathv('/', [GLib.get_user_data_dir(), 'notes@maestroschan.fr']);
			GLib.spawn_command_line_async('xdg-open ' + datadir);
		});

		let reset_button = builder.get_object('reset_btn');
		reset_button.connect('clicked', (widget) => {
			this._settings.set_boolean('ugly-hack', !this._settings.get_boolean('ugly-hack'));
		});
	},

	//--------------------------------------------------------------------------

	_buildAboutPage(builder) {
		builder.get_object('about_icon').set_from_pixbuf(
			GdkPixbuf.Pixbuf.new_from_file_at_size(this._path +
		                             '/screenshots/about_picture.png', 163, 114)
		);

		let ext_version = _("Version %s").replace('%s', this._extension.metadata.version.toString());
		builder.get_object('label_version').set_label(ext_version)

		let translation_credits = builder.get_object('translation_credits').get_label();
		if (translation_credits == 'translator-credits') {
			builder.get_object('translation_label').set_label('');
			builder.get_object('translation_credits').set_label('');
		}

		let ext_report_url = this._extension.metadata.url.toString();
		builder.get_object('report_link_button').set_uri(ext_report_url);
	}

});

//------------------------------------------------------------------------------

export default class NotesPreferences extends ExtensionPreferences {
	fillPreferencesWindow(window) {
		const prefsPage = new Adw.PreferencesPage({
				title: _("Notes Preferences"),
				icon_name: "dialog-information-symbolic",
		});

		const prefsGroup = new Adw.PreferencesGroup({
			title: "",
			description: _("Configure the appearance of the extension"),
		});

		let widget = new NotesSettingsWidget(this);

		prefsGroup.add(widget.prefs_stack);
		prefsPage.add(prefsGroup);
		window.add(prefsPage);

		window.set_default_size(625, 650);
	}
}
//------------------------------------------------------------------------------
