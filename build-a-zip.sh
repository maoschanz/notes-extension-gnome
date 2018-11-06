#!/bin/bash

#./update-and-compile-translations.sh --all

glib-compile-schemas ./schemas

zip notes@maestroschan.fr.zip convenience.js extension.js menus.js metadata.json prefs.js stylesheet.css screenshots/about_picture.png screenshots/help_picture_1.png screenshots/help_picture_2.png
zip -r notes@maestroschan.fr.zip schemas locale
