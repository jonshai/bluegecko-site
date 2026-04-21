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

export default defineConfig({
  security: {
    checkOrigin: false,
  },
  markdown: {
    remarkPlugins: [remarkAutoLink],
  },
  adapter: cloudflare(),
});
