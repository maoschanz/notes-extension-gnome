#!/bin/bash

./update-and-compile-translations.sh

cd notes@maestroschan.fr

glib-compile-schemas ./schemas

zip ../notes@maestroschan.fr.zip *.js
zip ../notes@maestroschan.fr.zip metadata.json
zip ../notes@maestroschan.fr.zip stylesheet.css

zip -r ../notes@maestroschan.fr.zip schemas
zip -r ../notes@maestroschan.fr.zip locale
zip -r ../notes@maestroschan.fr.zip screenshots


