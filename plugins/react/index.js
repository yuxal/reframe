module.exports = react;

function react() {
    const renderToHtml = require('./renderToHtml');
    const webpackBrowserConfig = require('./webpackBrowserConfig');
    const webpackNodejsConfig = require('./webpackNodejsConfig');

    return {
        name: require('./package.json').name,
        browserConfigFile: require.resolve('./browser.js'),
        webpackBrowserConfig,
        webpackNodejsConfig,
        renderToHtml,
    };

}
