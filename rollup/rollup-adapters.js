// build all the adapters

var buildModule = require("./rollup-module").buildModule;
var run = require("./build-util").run;
var fs = require("fs-extra");

var adapters = [
  "adapter-ajax-angular",
  "adapter-ajax-jquery",
  "adapter-data-service-odata",
  "adapter-data-service-webapi",
  "adapter-model-library-backing-store",
  "adapter-model-library-ko",
  "adapter-uri-builder-json",
  "adapter-uri-builder-odata"
];

// var tsfiles = adapters.map(a => 'src/' + a + '.ts').join(' ');
// var tsccmd = "npm run tsc-2015 -- --outDir temp/esm2015 " + tsfiles;

// run(tsccmd, function() {
adapters.forEach(function(a) {
  fs.copySync("./src/" + a + ".js", "./temp/esm2015/" + a + ".js");
  buildModule(a);
});

// })
