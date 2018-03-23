
var fs = require("fs-extra");
var replaceInFile = require("./rollup/build-util").replaceInFile;

// remove unneeded files that cause tsc errors
fs.remove("./node_modules/@types/highlight.js");

// remove line in acorn typings that won't compile with current TypeScript
var file = "./node_modules/@types/acorn/index.d.ts";
var search = "[Symbol.iterator](): Iterator<Token>;";
var replace = "// Symbol.iterator removed by postinstall.js";

replaceInFile(file, search, replace);
