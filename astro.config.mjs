// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import remarkAutolink from './src/plugins/remark-autolink.mjs';

export default defineConfig({
  security: {
    checkOrigin: false,
  },
  markdown: {
    remarkPlugins: [remarkAutolink],
  },
  adapter: cloudflare(),
});
