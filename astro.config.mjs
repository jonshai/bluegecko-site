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
      return html.replace(
        '</body>',
        '<script src="/stella-loader.js" defer></script></body>'
      );
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
