import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, '..', 'dist', 'client');

const SCRIPTS = [
  '<script src="/stella-loader.js" defer></script>',
  '<script src="/lead-form.js" defer></script>',
];

async function injectScripts(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    console.log('Directory not found:', dir);
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await injectScripts(fullPath);
    } else if (entry.name.endsWith('.html')) {
      let html = await readFile(fullPath, 'utf8');
      let changed = false;
      for (const script of SCRIPTS) {
        if (!html.includes(script)) {
          html = html.replace('</body>', script + '</body>');
          changed = true;
        }
      }
      if (changed) {
        await writeFile(fullPath, html);
        console.log('[inject] patched:', fullPath.split('dist/client/')[1] || entry.name);
      }
    }
  }
}

console.log('[inject] Starting script injection into dist/client/');
injectScripts(distDir)
  .then(() => console.log('[inject] Done'))
  .catch(e => { console.error('[inject] Error:', e); process.exit(1); });
