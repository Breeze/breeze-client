const replaceInFile = require("./build-util").replaceInFile;

// change `private` flag so dist can be published to npm
var file = "./dist/package.json";
var search = "\"private\": true,";
var replace = "\"private\": false,";

replaceInFile(file, search, replace);
