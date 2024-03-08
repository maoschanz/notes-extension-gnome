// notes@maestroschan.fr/dialog.js
// GPL v3
// Copyright 2018-2021 Romain F. T.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export const CustomModalDialog = GObject.registerClass(
class CustomModalDialog extends ModalDialog.ModalDialog {
	_init(textTitle, bodyWidget, textOkButton, callback) {
		super._init();
		let messageBox = new St.BoxLayout({vertical: true});

		let titleLabel = new St.Label({
			style: 'font-weight: bold; padding-bottom: 16px; width: 400px;',
			x_align: Clutter.ActorAlign.CENTER,
			text: textTitle,
		});

		messageBox.add_child(titleLabel);
		messageBox.add_child(bodyWidget);
		this.contentLayout.add_child(messageBox);

		// The method to add buttons is herited from ModalDialog
		this.setButtons([{
			label: _("Cancel"),
			action: () => { this.close(); },
			key: Clutter.Escape
		}, {
			label: textOkButton,
			action: () => {
				this.close();
				callback();
			}
		}]);
	}
});
