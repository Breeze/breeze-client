var path = require('path');
var webpack = require('webpack');

module.exports = {
  devtool: 'source-map',
  debug: true,

  entry: {
    'breeze-core.debug': [
      './src/breeze',
    ],
    'breeze.debug': [
      './src/breeze',
      './src/adapter-ajax-jquery',
      './src/adapter-ajax-angular',
      './src/adapter-model-library-backing-store',
      './src/adapter-model-library-ko',
      './src/adapter-data-service-webapi',
      './src/adapter-uri-builder-odata',
      './src/adapter-uri-builder-json',
    ],
   
  },

  output: {
    path: __dirname + '/build/',
    publicPath: 'build/',
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
    chunkFilename: '[id].chunk.js'
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

  plugins: [
    // new webpack.optimize.UglifyJsPlugin({
    //       compress: {
    //           warnings: false,
    //       },
    //       output: {
    //           comments: false,
    //       },
    // }),

  ],

  // target:'node-webkit'
  target: 'web'
};
