const VueServerRenderer = require('vue-server-renderer');
const HtmlCrust = require('@brillout/html-crust');
const containerId = 'root-vue';

module.exports = renderToHtml;

async function renderToHtml({pageConfig, initialProps}) {
    const renderer = VueServerRenderer.createRenderer();

    const contentHtml = await renderer.renderToString(pageConfig.view);

    const html = renderHtmlCrust(contentHtml, pageConfig);

    return html;
}

function renderHtmlCrust(contentHtml, pageConfig) {
    const htmlCrustOptions = Object.assign({bodyHtmls: []}, pageConfig);
    htmlCrustOptions.bodyHtmls.push('<div id="'+containerId+'">'+contentHtml+'</div>');

    const html = HtmlCrust(htmlCrustOptions);

    return html;
}
