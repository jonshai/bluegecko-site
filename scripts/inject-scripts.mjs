import { readdir, readFile, writeFile, copyFile, cp } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const clientDir = join(__dirname, '..', 'dist', 'client');
const serverDir = join(__dirname, '..', 'dist', 'server');

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

async function copyWorker() {
  // Cloudflare Pages Advanced Mode: _worker.js in the Pages output dir
  // entry.mjs imports from ./chunks/ — copy both so relative paths resolve
  await copyFile(join(serverDir, 'entry.mjs'), join(clientDir, '_worker.js'));
  console.log('[inject] copied entry.mjs → dist/client/_worker.js');

  await cp(join(serverDir, 'chunks'), join(clientDir, 'chunks'), { recursive: true });
  console.log('[inject] copied dist/server/chunks/ → dist/client/chunks/');

  // Copy any additional top-level .mjs files the Worker might import
  const serverEntries = await readdir(serverDir, { withFileTypes: true });
  for (const entry of serverEntries) {
    if (entry.isFile() && entry.name.endsWith('.mjs') && entry.name !== 'entry.mjs') {
      await copyFile(join(serverDir, entry.name), join(clientDir, entry.name));
      console.log('[inject] copied', entry.name, '→ dist/client/');
    }
  }
}

console.log('[inject] Starting script injection into dist/client/');
injectScripts(clientDir)
  .then(() => {
    console.log('[inject] HTML patching done');
    return copyWorker();
  })
  .then(() => console.log('[inject] Done'))
  .catch(e => { console.error('[inject] Error:', e); process.exit(1); });
