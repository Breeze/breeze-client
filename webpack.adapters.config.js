var path = require('path');
var webpack = require('webpack');
var ExternalsPlugin = require('webpack-externals-plugin');

module.exports = {
  devtool: 'source-map',
  debug: true,

  entry: {
    '_adapter.model-library-ko': [
      './src/adapter-model-library-ko',
    ]

  },

  output: {
    path: __dirname + '/build/',
    publicPath: 'build/',
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
    chunkFilename: '[id].chunk.js',

  },
  externals: {
    // require("breeze") is external and available
    //  on the global var breeze
    "./breeze": "breeze"
  },

  resolve: {
    extensions: ['', '.ts', '.js', '.json', '.css', '.html']
  },

  module: {
    loaders: [
      {
        test: /\.ts$/,
        loaders: ['ts'],
        exclude: [/node_modules/]
      },
      {
        test: /\.html$/,
        loader: 'html?attrs=false'  // attrs=false means don't resolve links within the html'
      },
      // {
      //   test: /\.(png|jpe?g|gif|svg|woff|woff2|ttf|eot|ico)$/,
      //   loader: 'url'
      // },

    ]
  },

  // plugins: [
  //   new ExternalsPlugin({
  //     type: 'commonjs',
  //     exclude: __dirname + '/src/breeze',
  //   }),
  // ],
  // target:'node-webkit'
  target: 'web'
};
