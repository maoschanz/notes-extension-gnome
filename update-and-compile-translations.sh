#!/bin/bash

EXTENSION_ID="notes@maestroschan.fr"
TRANSLATION_ID="notes-extension"

if [ $# = 0 ]; then
	echo "No parameter, exiting now."
	echo ""
	echo "Parameters and options for this script:"
	echo "	xx		update only the language xx, and compile only xx"
	echo "	--pot		update the pot file"
	echo "	--compile	compile all languages (without updating them first)"
	echo "	--all		update all translations files, and compile them all"
	echo "	--add xx	add a .po file for the language xx"
	exit 1
fi

################################################################################

function update_pot () {
	echo "Generating .pot file..."
	xgettext --files-from=POTFILES.in --from-code=UTF-8 --add-location=file --output=$EXTENSION_ID/locale/$TRANSLATION_ID.pot
}

function update_lang () {
	echo "Updating translation for: $1"
	msgmerge --update --previous $prefix/$1/LC_MESSAGES/$TRANSLATION_ID.po $prefix/$TRANSLATION_ID.pot
}

function compile_lang () {
	echo "Compiling translation for: $1"
	msgfmt $prefix/$1/LC_MESSAGES/$TRANSLATION_ID.po -o $prefix/$1/LC_MESSAGES/$TRANSLATION_ID.mo
	rm -f "$prefix/$1/LC_MESSAGES/$TRANSLATION_ID.po~"
}

function create_po () {
	mkdir -p $prefix/$1/LC_MESSAGES
	msginit -i $prefix/$TRANSLATION_ID.pot --locale=el_GR -o $prefix/$1/LC_MESSAGES/$TRANSLATION_ID.po
	update_lang $1
}

################################################################################

IFS='
'
liste=`ls ./$EXTENSION_ID/locale/`
prefix="./$EXTENSION_ID/locale"

if [ $1 = "--all" ]; then
	update_pot
	for lang_id in $liste
	do
		if [ "$lang_id" != "$TRANSLATION_ID.pot" ]; then
			update_lang $lang_id
			compile_lang $lang_id
		fi
	done
elif [ $1 = "--pot" ]; then
	update_pot
elif [ $1 = "--compile-only" ]; then
	for lang_id in $liste
	do
		if [ "$lang_id" != "$TRANSLATION_ID.pot" ]; then
			compile_lang $lang_id
		fi
	done
elif [ $1 = "--add" ]; then
	create_po $2
else
	for lang_id in $@
	do
		if [ "$lang_id" != "$TRANSLATION_ID.pot" ]; then
			update_lang $lang_id
			compile_lang $lang_id
		fi
	done
fi

exit 0

