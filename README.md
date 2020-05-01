# barrel-rider-sidecar

Create Index Files for Typescript

Based roughly on https://github.com/sw-yx/barrelbot

HOW TO USE:

Add a script to your package.json like this:

"sidecar": "yarn barrel-rider-sidecar --watch --src src components lib",

Then add

"&& yarn sidecar"

to the end of your yarn start command, or however you start your application

VS CODE USERS: I recommend hiding sidecar files

https://stackoverflow.com/questions/30140112/how-do-i-hide-certain-files-from-the-sidebar-in-visual-studio-code

settings.json:

"files.exclude": {
"\*_/_-sidecar.ts": true
},
