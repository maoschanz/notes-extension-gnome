#!/bin/bash

if (( $EUID == 0 )); then

	if [ ! -d "/usr/share/gnome-shell/extensions" ]; then
		mkdir /usr/share/gnome-shell/extensions
	fi
	
	INSTALL_DIR="/usr/share/gnome-shell/extensions/notes@maestroschan.fr"

else

	if [ ! -d "$HOME/.local/share/gnome-shell/extensions" ]; then
		mkdir $HOME/.local/share/gnome-shell/extensions
	fi
	
	INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/notes@maestroschan.fr"

fi

if [ ! -d "$INSTALL_DIR" ]; then
	mkdir $INSTALL_DIR
fi

echo "Installing extension files in $INSTALL_DIR"

cp convenience.js $INSTALL_DIR/convenience.js
cp extension.js $INSTALL_DIR/extension.js
cp menus.js $INSTALL_DIR/menus.js
cp prefs.js $INSTALL_DIR/prefs.js
cp stylesheet.css $INSTALL_DIR/stylesheet.css
cp metadata.json $INSTALL_DIR/metadata.json

cp -r screenshots $INSTALL_DIR
cp -r schemas $INSTALL_DIR
cp -r locale $INSTALL_DIR

echo "Done."

echo "Restarting GNOME Shell..."

dbus-send --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:'Meta.restart(_("Restarting…"))'

exit

