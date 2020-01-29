// create "node_modules/breeze-client.js" so that "breeze-client" can be resolved at runtime
var fs = require("fs");
var breezepath = "node_modules/breeze-client.js";
// var breezecode = "module.exports = require(\"../src/breeze\");";
// var breezecode = "module.exports = require(\"../dist/breeze-client\");";
var breezecode = "module.exports = require(\"../dist/bundles/breeze-client.umd\");";


if (!fs.existsSync(breezepath)) {
  fs.appendFileSync(breezepath, breezecode);
  console.log("Created " + breezepath);
}
