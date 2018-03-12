
var fs = require("fs-extra");

// remove unneeded files that cause tsc errors
fs.remove("./node_modules/@types/highlight.js");
