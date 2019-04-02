
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext.domain('notes-extension');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

//------------------------------------------------------------------------------

function init() {
	Convenience.initTranslations();
}

let SETTINGS = Convenience.getSettings();

//------------------------------------------------------------------------------

const NotesSettingsWidget = new GObject.Class({
	Name: 'NotesSettingsWidget',
	GTypeName: 'NotesSettingsWidget',

	_init: function() {
		let builder = new Gtk.Builder();
		builder.add_from_file(Me.path+'/prefs.ui');
		this.prefs_stack = builder.get_object('prefs_stack');
		
		this.switcher = new Gtk.StackSwitcher({
			halign: Gtk.Align.CENTER,
			visible: true,
			stack: this.prefs_stack
		});
		
		//----------------------------------------------------------------------
		
		let position_combobox = builder.get_object('position_combobox');
		
		position_combobox.append('special-layer', _("Above everything"));
		position_combobox.append('on-background', _("On the background"));
		position_combobox.append('above-all', _("Above all, without mask"));
	
		position_combobox.active_id = SETTINGS.get_string('layout-position');
		
		position_combobox.connect("changed", (widget) => {
			SETTINGS.set_string('layout-position', widget.get_active_id());
			if( (widget.get_active_id() == 'above-all') || (widget.get_active_id() == 'special-layer') ) {
				hide_switch.set_sensitive(false);
			} else {
				hide_switch.set_sensitive(true);
			}
		});

		//----------------------------------------------------------------------

		let hide_switch = builder.get_object('hide_switch');
		hide_switch.set_state(SETTINGS.get_boolean('hide-icon'));
		hide_switch.connect('notify::active', (widget) => {
			if (widget.active) {
				SETTINGS.set_boolean('hide-icon', true);
			} else {
				SETTINGS.set_boolean('hide-icon', false);
			}
		});

		//----------------------------------------------------------------------

		let keybinding_entry = builder.get_object('keybinding_entry');
		keybinding_entry.set_sensitive(SETTINGS.get_boolean('use-shortcut'));

		if (SETTINGS.get_strv('keyboard-shortcut') != '') {
			keybinding_entry.text = SETTINGS.get_strv('keyboard-shortcut')[0];
		}

		let keybinding_button = builder.get_object('keybinding_button');
		keybinding_button.set_sensitive(SETTINGS.get_boolean('use-shortcut'));

		keybinding_button.connect('clicked', (widget) => {
			SETTINGS.set_strv('keyboard-shortcut', [keybinding_entry.text]);
		});

		let keybinding_switch = builder.get_object('keybinding_switch');
		keybinding_switch.set_state(SETTINGS.get_boolean('use-shortcut'));

		keybinding_switch.connect('notify::active', (widget) => {
			if (widget.active) {
				SETTINGS.set_boolean('use-shortcut', true);
				keybinding_entry.sensitive = true;
				keybinding_button.sensitive = true;
				hide_switch.sensitive = true;
			} else {
				SETTINGS.set_boolean('use-shortcut', false);
				keybinding_entry.sensitive = false;
				keybinding_button.sensitive = false;
				hide_switch.sensitive = false;
			}
		});

//		//----------------------------------------------------------------------
//		
//		this.build_help_page();

		//----------------------------------------------------------------------
		
		builder.get_object('about_icon').set_from_pixbuf(
			GdkPixbuf.Pixbuf.new_from_file_at_size(Me.path +
			                         '/screenshots/about_picture.png', 326, 228)
		);
		
		let translation_credits = builder.get_object('translation_credits').get_label();
		if (translation_credits == 'translator-credits') {
			builder.get_object('translation_label').set_label('');
			builder.get_object('translation_credits').set_label('');
		}
		
		let linkBox = builder.get_object('link_box')// FIXME padding ???
		let a_version = ' (v' + Me.metadata.version.toString() + ') ';
		
		let url_button = new Gtk.LinkButton({
			label: _("Report bugs or ideas"),
			uri: Me.metadata.url.toString()
		});
		
		linkBox.pack_start(url_button, false, false, 0);
		linkBox.pack_end(new Gtk.Label({ label: a_version, halign: Gtk.Align.START }), false, false, 0);
		
		//----------------------------------------------------------------------
		
		this.switcher.show_all();
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
		data_button.connect('clicked', (widget) => {
			GLib.spawn_command_line_async('xdg-open .local/share/notes@maestroschan.fr');
		});
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
		reset_button.connect('clicked', (widget) => {
			SETTINGS.set_boolean('ugly-hack', !SETTINGS.get_boolean('ugly-hack'));
		});
		reset_box.add(reset_label);
		reset_box.add(reset_button);
		tabs.append_page(reset_box, new Gtk.Label({ label: _("Lost some notes?"), }))
	},
});

//-----------------------------------------------

//I guess this is like the "enable" in extension.js : something called each
//time he user try to access the settings' window
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

//-----------------------------------------------
