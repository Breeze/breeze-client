// Generate a bundle from a single js file.  This is for breeze adapters.
var rollup = require( 'rollup' );
var banner = require('./banner').banner;
var getArg = require('./build-util').getArg;
var _ = require('lodash');


// if running this file directly
if (process.argv[1].indexOf("rollup-single.js") >= 0) {
  // get from command-line arguments
  var arg0 = getArg();   // 'adapter-ajax-angular';
  buildBundle(arg0);
}

function buildBundle(root) {

  var moduleName = _.camelCase('breeze-' + root); // 'breezeAdapterAjaxAngular'

  var src = './temp/esm2015/' + root + '.js';
  var dest = './temp/esm2015/' + root + '.umd.js'; // must be transpiled after
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
}

module.exports = {
  buildBundle: buildBundle
}

