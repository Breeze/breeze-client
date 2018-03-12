// Generate a bundle from a single js file.  This is for breeze adapters.
var rollup = require( 'rollup' );
var banner = require('./banner').banner;
var _ = require('lodash');

var args = process.argv.slice(2);
if (args.length !== 1 || args[0].indexOf('.js') >= 0) {
  var msg = "Usage: " + process.argv[0] + " " + process.argv[1] + " [filenameRoot]\n" + 
  "Example: node rollup.single.js adapter-ajax-angular\n";
  throw new Error(msg);
}

// get from command-line arguments
var root = args[0];   // 'adapter-ajax-angular';
var moduleName = _.camelCase('breeze-' + root); // 'breezeAdapterAjaxAngular'

var src = './src/' + root + '.js';
var dest = './temp/' + root + '.es2015.js'; // must be transpiled after
var format = 'umd';

rollup.rollup({
  // path to main entry point
  input: src,

  external: function(id) { 
    // keep external modules (e.g. breeze) out of this bundle
    return (id !== src); 
  }

}).then( function ( bundle ) {

  // Generate bundle + sourcemap
  return bundle.write({
    format: 'umd',
    // name of module (for umd/iife bundles)
    name: moduleName,
    file: dest,
    banner: banner,
    sourcemap: true,
    paths: function(id) { 
      // convert require()'s to 'breeze-client'
      if (id !== src && id !== moduleName) return 'breeze-client'; 
    },
    globals: function(id) { 
      // convert global dependencies to 'breeze'
      if (id !== src && id !== moduleName) return 'breeze'; 
    }
  });
}).then(function() {
    console.log("wrote " + dest);
});