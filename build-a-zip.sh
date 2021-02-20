#!/bin/bash

./update-and-compile-translations.sh --all

cd notes@maestroschan.fr

glib-compile-schemas ./schemas

zip ../notes@maestroschan.fr.zip *.ui
zip ../notes@maestroschan.fr.zip *.js
zip ../notes@maestroschan.fr.zip *.json
zip ../notes@maestroschan.fr.zip *.css

zip -r ../notes@maestroschan.fr.zip schemas
zip -r ../notes@maestroschan.fr.zip locale
zip -r ../notes@maestroschan.fr.zip screenshots


