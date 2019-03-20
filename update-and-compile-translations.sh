#!/bin/bash

#####

echo "Generating .pot file..."

xgettext --files-from=POTFILES.in --from-code=UTF-8 --output=notes@maestroschan.fr/locale/notes.pot

#####

IFS='
'
liste=`ls ./notes@maestroschan.fr/locale/`
prefix="./notes@maestroschan.fr/locale"

for dossier in $liste
do
	if [ "$dossier" != "notes.pot" ]; then
		echo "Updating translation for: $dossier"
		msgmerge -N $prefix/$dossier/LC_MESSAGES/notes.po $prefix/notes.pot > $prefix/$dossier/LC_MESSAGES/notes.temp.po
		mv $prefix/$dossier/LC_MESSAGES/notes.temp.po $prefix/$dossier/LC_MESSAGES/notes.po
		echo "Compiling translation for: $dossier"
		msgfmt $prefix/$dossier/LC_MESSAGES/notes.po -o $prefix/$dossier/LC_MESSAGES/notes.mo
	fi
done

#####

exit 0
