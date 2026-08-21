const path = require('path');
const webpack = require('webpack');
const config = require('./webpack.config.js');

// 1. Remove UI entries & boilerplates
const uiEntries = ['execute', 'newtab', 'popup', 'params'];
for (const key of uiEntries) {
  delete config.entry[key];
}
delete config.chromeExtensionBoilerplate;

// 2. Change output path to local dist folder
config.output.path = path.resolve(__dirname, 'dist/cli-runner');
config.output.publicPath = '/';

// 3. Remove HtmlWebpackPlugin for UI entries and update CopyWebpackPlugin
config.plugins = config.plugins.filter((plugin) => {
  if (plugin.constructor.name === 'HtmlWebpackPlugin') {
    const chunk = plugin.userOptions?.chunks?.[0];
    if (chunk && uiEntries.includes(chunk)) {
      return false; // Remove this plugin
    }
  }

  // Update CopyWebpackPlugin patterns
  if (plugin.constructor.name === 'CopyPlugin' && plugin.patterns) {
    plugin.patterns.forEach((pattern) => {
      // Change target directory from build or build-runner to dist/cli-runner
      if (pattern.to && typeof pattern.to === 'string') {
        pattern.to = pattern.to.replace(/build(-runner)?/, 'dist' + path.sep + 'cli-runner');
      }

      // Modify manifest transform for Runner
      if (pattern.from && typeof pattern.from === 'string' && pattern.from.includes('manifest') && pattern.transform) {
        const originalTransform = pattern.transform;
        pattern.transform = (content, absoluteFrom) => {
          const originalResult = originalTransform(content, absoluteFrom);
          const manifestObj = JSON.parse(originalResult.toString());
          
          // Strip UI permissions and overrides
          delete manifestObj.action;
          delete manifestObj.options_ui;
          delete manifestObj.chrome_url_overrides;
          delete manifestObj.sandbox;
          manifestObj.name = `${manifestObj.name} (Runner)`;
          
          return Buffer.from(JSON.stringify(manifestObj));
        };
      }
    });
  }

  return true;
});

// 4. Mocks & Aliases for runner
config.resolve.alias['@/utils/api'] = path.resolve(__dirname, 'business/dev/utils/api-runner-mock.js');
config.resolve.alias['webextension-polyfill'] = path.resolve(__dirname, 'business/dev/lib/browser-compat.js');

// Inject the runner initialization to offscreen entry point
config.entry.offscreen = [path.resolve(__dirname, 'business/dev/inject-offscreen.js'), config.entry.offscreen];

// 5. Add __IS_RUNNER__ define variable
config.plugins.push(
  new webpack.DefinePlugin({
    __IS_RUNNER__: JSON.stringify(true),
  })
);

// 6. Disable cache to guarantee fresh runner build
config.cache = false;

// 7. Generate an empty dummy.html for CLI background execution without triggering listeners
const HtmlWebpackPlugin = require('html-webpack-plugin');
config.plugins.push(
  new HtmlWebpackPlugin({
    filename: 'dummy.html',
    templateContent: '<!DOCTYPE html><html><head></head><body></body></html>',
    chunks: []
  })
);

module.exports = config;
