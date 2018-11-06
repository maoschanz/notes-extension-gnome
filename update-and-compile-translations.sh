#!/bin/bash

#####

if ! [ -x "$(command -v jq)" ]; then
	echo '`jq` is not installed, aborting.' >&2
	exit 1
fi

#####

echo "Generating .pot file..."

name=`cat metadata.json | jq -r '.name'`
description=`cat metadata.json | jq -r '.description'`
echo "_(\"$name\")" > other-strings.js
echo "_(\"$description\")" >> other-strings.js

xgettext --files-from=POTFILES.in --from-code=UTF-8 --output=locale/notes-extension.pot

#####

if [ $# = 0 ]; then
	echo "No parameter, exiting now."
	echo "Deleting temporary files"
	rm other-strings.js
	exit 1
fi

IFS='
'
liste=`ls ./locale/`

if [ $1 = "--all" ]; then
	for dossier in $liste
	do
		if [ "$dossier" != "notes-extension.pot" ]; then
			echo "Updating translation for: $dossier"
			msgmerge ./locale/$dossier/LC_MESSAGES/notes-extension.po ./locale/notes-extension.pot > ./locale/$dossier/LC_MESSAGES/notes-extension.temp.po
			mv ./locale/$dossier/LC_MESSAGES/notes-extension.temp.po ./locale/$dossier/LC_MESSAGES/notes-extension.po
			echo "Compiling translation for: $dossier"
			msgfmt ./locale/$dossier/LC_MESSAGES/notes-extension.po -o ./locale/$dossier/LC_MESSAGES/notes-extension.mo
		fi
	done
else
	for dossier in $@
	do
		if [ "$dossier" != "notes-extension.pot" ]; then
			echo "Updating translation for: $dossier"
			msgmerge ./locale/$dossier/LC_MESSAGES/notes-extension.po ./locale/notes-extension.pot > ./locale/$dossier/LC_MESSAGES/notes-extension.temp.po
			mv ./locale/$dossier/LC_MESSAGES/notes-extension.temp.po ./locale/$dossier/LC_MESSAGES/notes-extension.po
			echo "Compiling translation for: $dossier"
			msgfmt ./locale/$dossier/LC_MESSAGES/notes-extension.po -o ./locale/$dossier/LC_MESSAGES/notes-extension.mo
		fi
	done
fi

#####

echo "Deleting temporary files"
rm other-strings.js

exit 0
