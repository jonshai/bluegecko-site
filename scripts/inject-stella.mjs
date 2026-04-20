import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const distDir = new URL('../dist/client', import.meta.url).pathname;

async function injectScript(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await injectScript(fullPath);
    } else if (entry.name.endsWith('.html')) {
      let html = await readFile(fullPath, 'utf8');
      if (!html.includes('stella-loader.js')) {
        html = html.replace('</body>',
          '<script src="/stella-loader.js" defer></script></body>');
        await writeFile(fullPath, html);
        console.log('Injected:', fullPath);
      }
    }
  }
}

injectScript(distDir).catch(console.error);
