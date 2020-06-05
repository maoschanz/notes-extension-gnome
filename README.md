# Sticky notes extension

A GNOME Shell extension providing customizable sticky notes.

![](./notes@maestroschan.fr/screenshots/about_picture.png)

The last version (18, released on the 28/05/2020) is compatible only with the
following versions of GNOME Shell:

- 3.30
- 3.32
- 3.34
- 3.36

----

## Installation

### Recommended

From [this website](https://extensions.gnome.org/extension/1357/notes/), or from
the _GNOME Software_ app.

### Not recommended (can have bugs, will not get updates)

Download the files, run `./install.sh`, restart the session, enable the extension

## Storage

Notes are stored in files at `~/.local/share/notes@maestroschan.fr/*_text`

<!-- TODO

pas de raise correct quand on focus une note sans focus automatique

mettre le putain d'array en attribut du singleton "notesmanager"

"éditer le titre" dans le menu
le bouton de grab aurait le titre en label, et clic-droit enroulerait

sa mère faut réécrire comment ça interagit avec le disque, là c'est hoooonteux

    -->


