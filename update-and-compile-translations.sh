#!/bin/bash

echo "Generating .pot file..."
xgettext --files-from=files-list --output=locale/notes-extension.pot

IFS='
'
liste=`ls ./locale/`

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

exit 0
