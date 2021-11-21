#!/bin/bash

EXT_ID=notes@maestroschan.fr

./update-and-compile-translations.sh --all

cd $EXT_ID

glib-compile-schemas ./schemas

zip ../$EXT_ID.zip *.ui
zip ../$EXT_ID.zip *.js
zip ../$EXT_ID.zip *.json
zip ../$EXT_ID.zip *.css

zip -r ../$EXT_ID.zip schemas
zip -r ../$EXT_ID.zip locale
zip -r ../$EXT_ID.zip screenshots

shopt -s globstar

zip -d ../$EXT_ID.zip **/*.pot
zip -d ../$EXT_ID.zip **/*.po

