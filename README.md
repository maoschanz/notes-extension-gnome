# Sticky notes extension

A GNOME Shell extension providing customizable sticky notes.

![](./notes@maestroschan.fr/screenshots/about_picture.png)

### Compatible versions

Version 19 has been released the 06/10/2020

| GNOME Shell version | Extension version 19 | 18  | 17  | 15  |
|---------------------|----------------------|-----|-----|-----|
| **3.38**            | Yes                  |     |     |     |
| **3.36**            | Yes                  | Yes |     |     |
| **3.34**            | ??                   | Yes |     |     |
| **3.32**            | ??                   | Yes | Yes |     |
| **3.30**            | ??                   | Yes | Yes | Yes |
| **3.28**            |                      |     | Yes | Yes |
| **3.26**            |                      |     | Yes | Yes |
| **3.24**            |                      |     |     | Yes |
| **3.22**            |                      |     |     | Yes |

### Available languages


| code  | Language name |
|-------|---------------|
|       | English       |
| es    | Castillan     |
| fr    | French        |
| hr    | Croatian      |
| nl    | Dutch         |
| es    | Castillan     |
| tr    | Turkish       |
| zh_TW | Chinese (traditional)

----

## Installation

### Recommended

From [this website](https://extensions.gnome.org/extension/1357/notes/), or from
the _GNOME Software_ app.

[<img alt="" height="100" src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true">](https://extensions.gnome.org/extension/1357/notes/)

### Not recommended

**Installing unstable code from github means you can have bugs, and you will not
get updates for the extensions**

Download the files, run `./install.sh`, restart the session, enable the extension

----

## Storage

Data are stored on your disk: files are in `~/.local/share/notes@maestroschan.fr`

<!-- TODO

si pas de motion ni de release après 1000ms, bouger la note de force (et si
besoin relâcher le bouton) ⇒ attention justperfection2 m'a donné de quoi ne plus
faire de la merde en termes de move au moins. (j'y crois moyen mais heh)
https://old.reddit.com/r/gnome/comments/h08ysq/sticky_notes_extension_now_compatible_with_gnome/fuzz33o/
https://gitlab.gnome.org/justperfection.channel/gnome-shell-extension-samples/-/blob/master/samples/move-container@example.com/extension.js
https://www.youtube.com/watch?v=2qVn6CjlDUQ

fuck les headers alternatifs, faisons vraiment des dialogues ce sera plus simple

(à revérifier) pas de raise correct quand on focus une note sans focus automatique

"éditer le titre" dans le menu
le bouton de grab aurait le titre en label, et clic-droit enroulerait


    -->

<!-- useful commands to develop:

```
gjs /usr/share/gnome-shell/org.gnome.Shell.Extensions
gnome-extensions prefs notes@maestroschan.fr
```
    -->

