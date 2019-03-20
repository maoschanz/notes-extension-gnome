#!/bin/bash

#####

echo "Generating .pot file..."

xgettext --files-from=POTFILES.in --from-code=UTF-8 --output=notes@maestroschan.fr/locale/notes-extension.pot

#####

IFS='
'
liste=`ls ./notes@maestroschan.fr/locale/`
prefix="./notes@maestroschan.fr/locale"

for dossier in $liste
do
	if [ "$dossier" != "notes-extension.pot" ]; then
		echo "Updating translation for: $dossier"
		msgmerge -N $prefix/$dossier/LC_MESSAGES/notes-extension.po $prefix/notes-extension.pot > $prefix/$dossier/LC_MESSAGES/notes-extension.temp.po
		mv $prefix/$dossier/LC_MESSAGES/notes-extension.temp.po $prefix/$dossier/LC_MESSAGES/notes-extension.po
		echo "Compiling translation for: $dossier"
		msgfmt $prefix/$dossier/LC_MESSAGES/notes-extension.po -o $prefix/$dossier/LC_MESSAGES/notes-extension.mo
	fi
done

#####

exit 0
