var fs = require("fs-extra");
var getArg = require("./build-util").getArg;
var isDifferent = require("./build-util").isDifferent;
var buildBundle = require("./rollup-single").buildBundle;
var run = require("./build-util").run;

// if running this file directly
if (process.argv[1].indexOf("rollup-module.js") >= 0) {
  // get from command-line arguments
  var arg0 = getArg();   // 'adapter-ajax-angular';
  buildModule(arg0);
}

function buildModule(root) {

  buildBundle(root); // create the es2015 rollup bundle

  var es5cmd = "npm run tsc-es5 -- --out temp/esm5/" + root + ".umd.js temp/esm2015/" + root + ".umd.js";
  var mincmd = "npm run minify -- --output temp/esm5/" + root + ".umd.min.js temp/esm5/" + root + ".umd.js";

  var srcName = "temp/esm5/" + root + ".umd.js";
  var destName = "dist/adapters/" + root + ".umd.js";
  var srcMin = "temp/esm5/" + root + ".umd.min.js";
  var destMin = "dist/adapters/" + root + ".umd.min.js";

  run(es5cmd, function () {
    if (isDifferent(srcName, destName)) {
      fs.copySync(srcName, destName);

      run(mincmd, function () {
        if (isDifferent(srcMin, destMin)) {
          fs.copySync(srcMin, destMin);
        }
      })
    }
  });

}

module.exports = {
  buildModule: buildModule
}

