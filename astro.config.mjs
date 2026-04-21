// @ts-check
import { defineConfig } from 'astro/config';
import { visit } from 'unist-util-visit';
import { autoLink } from './src/utils/autoLink';
import cloudflare from '@astrojs/cloudflare';

function remarkAutoLink() {
  return (tree) => {
    visit(tree, 'html', (node) => {
      if (!node.value) return;
      node.value = autoLink(node.value);
    });
  };
}

function stellaWidgetPlugin() {
  return {
    name: 'stella-widget-inject',
    transformIndexHtml(html) {
      // Inject stella widget loader
      html = html.replace(
        '</body>',
        '<script src="/stella-loader.js" defer></script></body>'
      );
      // Inject lead form handler
      html = html.replace(
        '</body>',
        '<script src="/lead-form.js" defer></script></body>'
      );
      console.log('[stella-plugin] injecting scripts into:',
        html.includes('stella-loader') ? 'ok' : 'MISSING stella',
        html.includes('lead-form') ? 'ok' : 'MISSING lead-form'
      );
      return html;
    },
  };
}

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkAutoLink],
  },
  vite: {
    plugins: [stellaWidgetPlugin()],
  },
  adapter: cloudflare(),
});
