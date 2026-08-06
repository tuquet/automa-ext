const webpack = require('webpack');
const path = require('path');
const fileSystem = require('fs-extra');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const env = require('./utils/env');

const alias = {
  '@': path.resolve(__dirname, 'src/'),
  secrets: path.join(__dirname, 'secrets.blank.js'),
  '@business': path.resolve(__dirname, 'business/dev'),
  // THE MAGIC: Swap out browser API with vscode API
  './browser-compat.js$': path.resolve(__dirname, 'src/lib/vscode-compat.js'),
  '../lib/browser-compat.js$': path.resolve(__dirname, 'src/lib/vscode-compat.js'),
  '@/lib/browser-compat.js$': path.resolve(__dirname, 'src/lib/vscode-compat.js'),
  './browser-compat': path.resolve(__dirname, 'src/lib/vscode-compat.js'),
  '../lib/browser-compat': path.resolve(__dirname, 'src/lib/vscode-compat.js'),
  '@/lib/browser-compat': path.resolve(__dirname, 'src/lib/vscode-compat.js'),
};

const options = {
  mode: process.env.NODE_ENV || 'production',
  entry: {
    newtab: path.join(__dirname, 'src', 'newtab', 'index.js'),
  },
  output: {
    // Output directly to the automa-vscode folder
    path: path.resolve(__dirname, '../automa-vscode/webview-ui/dist'),
    filename: '[name].bundle.js',
    publicPath: '',
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: { reactivityTransform: true },
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(json5?|ya?ml)$/,
        type: 'javascript/auto',
        include: [path.resolve(__dirname, './src/locales')],
        loader: '@intlify/vue-i18n-loader',
      },
      {
        test: /\.(jpg|jpeg|png|gif|eot|otf|svg|ttf|woff|woff2)$/,
        type: 'asset/resource',
        dependency: { not: [/node_modules/] },
        generator: { filename: '[name][ext]' },
      },
      {
        test: /\.js$/,
        use: ['babel-loader'],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    alias,
    extensions: ['.js', '.vue', '.css'],
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(
      /browser-compat/,
      path.resolve(__dirname, 'src/lib/vscode-compat.js')
    ),
    new MiniCssExtractPlugin(),
    new VueLoaderPlugin(),
    new webpack.DefinePlugin({ BROWSER_TYPE: JSON.stringify('vscode') }),
    new CleanWebpackPlugin({ verbose: false }),
    new webpack.EnvironmentPlugin(['NODE_ENV']),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'newtab', 'index.html'),
      filename: 'index.html',
      chunks: ['newtab'],
      cache: false,
    }),
    new webpack.DefinePlugin({
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_I18N_FULL_INSTALL__: JSON.stringify(true),
      __INTLIFY_PROD_DEVTOOLS__: JSON.stringify(false),
      __VUE_I18N_LEGACY_API__: JSON.stringify(false),
    }),
  ]
};

module.exports = options;
