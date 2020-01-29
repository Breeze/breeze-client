/** 
 * Append breeze UMD libraries together to make something like the breeze.debug.js from Breeze 1.x
 * Save the file in the breezeTests directory so it can be run with the test suite
 */
var fs = require("fs-extra");

var sourceDir = 'dist/bundles/';
var destFile = fs.realpathSync('../breeze.js/test/breeze/breeze.debug.js');
var files = [
  'breeze-client.umd.js',
  'breeze-client-adapter-model-library-backing-store.umd.js',
  'breeze-client-adapter-uri-builder-odata.umd.js',
  'breeze-client-adapter-uri-builder-json.umd.js',
  'breeze-client-adapter-ajax-fetch.umd.js',
  'breeze-client-adapter-ajax-angularjs.umd.js',
  'breeze-client-adapter-ajax-fake',
  'breeze-client-adapter-data-service-webapi.umd.js',
];

var stream = fs.createWriteStream(destFile, {flags:'w'});
console.log('Copying to ' + destFile);

files.forEach(file => {
  var data = fs.readFileSync(sourceDir + file, { encoding: 'utf-8'});
  stream.write(data);
})
stream.end();
