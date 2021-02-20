// notes@maestroschan.fr/dialog.js
// GPL v3
// Copyright 2018-2021 Romain F. T.

const { St, Clutter, GObject } = imports.gi;
const ModalDialog = imports.ui.modalDialog;

var CustomModalDialog = GObject.registerClass(
class CustomModalDialog extends ModalDialog.ModalDialog {
	_init(text_title, body_widget, text_ok, callback) {
		super._init();
		let message_box = new St.BoxLayout({vertical: true});

		let title_label = new St.Label({
			style: 'font-weight: bold; padding-bottom: 16px; width: 400px;',
			x_align: Clutter.ActorAlign.CENTER,
			text: text_title,
		});

		message_box.add_child(title_label);
		message_box.add_child(body_widget);
		this.contentLayout.add_child(message_box);

		// The method to add buttons is herited from ModalDialog
		this.setButtons([{
			label: _("Cancel"),
			action: () => { this.close(); },
			key: Clutter.Escape
		}, {
			label: text_ok,
			action: () => {
				this.close();
				callback();
			}
		}]);
	}
});

