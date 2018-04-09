import multiEntry from 'rollup-plugin-multi-entry';
var banner = require('./banner').banner;

export default {
    input: [
        './src/breeze.js',
        './src/interface-registry.js',
        './src/adapter-ajax-jquery.js',
        './src/adapter-ajax-angularjs.js',
        './src/adapter-model-library-backing-store.js',
        './src/adapter-data-service-webapi.js',
        './src/adapter-uri-builder-odata.js',
        './src/adapter-uri-builder-json.js',
    ],

    output: {
        name: 'breeze',
        sourcemap: true,
        file: './temp/breeze.full.es2015.js', // must be transpiled after
        format: 'umd',
        banner: banner,
    },
    plugins: [
        multiEntry()
    ]
}
