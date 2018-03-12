import multiEntry from 'rollup-plugin-multi-entry';
var banner = require('./banner').banner;

export default {
    input: [
        './src/breeze.js',
        './src/interface-registry.js',
        './src/abstract-data-service-adapter.js'
    ],

    output: {
        name: 'breeze',
        sourcemap: true,
        file: './temp/breeze.base.es2015.js', // must be transpiled after
        format: 'umd'
    },
    banner: banner,
    plugins: [
        multiEntry()
    ]
}
