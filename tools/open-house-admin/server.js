/**
 * Blue Gecko Open House Admin Server
 * Plain Node.js — no framework, no extra dependencies.
 * Setup: copy .env.example to .env, add your token, then run:
 *   node tools/open-house-admin/server.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const PORT = 3333;

// ── Load .env from tools/open-house-admin/.env (no dotenv dependency) ────────
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
  console.log('[env] Loaded .env');
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'jonshai/bluegecko-site';
const BRANCH = 'main';

// ── GitHub API ────────────────────────────────────────────────────────────────

function githubRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'bluegecko-admin/1.0',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getFileSha(repoPath) {
  if (!GITHUB_TOKEN) return null;
  const res = await githubRequest('GET', `/repos/${REPO}/contents/${repoPath}?ref=${BRANCH}`);
  if (res.status !== 200) {
    console.log(`[getFileSha] ${repoPath} → status ${res.status} (not on branch ${BRANCH})`);
    return null;
  }
  const sha = typeof res.data === 'object' && !Array.isArray(res.data) ? res.data.sha : null;
  if (!sha || typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha.trim())) {
    console.warn(`[getFileSha] unexpected sha value for ${repoPath}:`, JSON.stringify(sha));
    return null;
  }
  console.log(`[getFileSha] ${repoPath} → sha ${sha}`);
  return sha.trim();
}

async function commitFile(repoPath, content, message) {
  if (!GITHUB_TOKEN) {
    console.warn('No GITHUB_TOKEN — skipping GitHub commit for', repoPath);
    return { ok: true, github: false };
  }

  const sha = await getFileSha(repoPath);
  const encoded = Buffer.from(content).toString('base64');
  const body = { message, content: encoded, branch: BRANCH };
  if (sha) body.sha = sha;

  const res = await githubRequest('PUT', `/repos/${REPO}/contents/${repoPath}`, body);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`GitHub API error ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return { ok: true, github: true };
}

async function deleteFileFromGitHub(repoPath, message) {
  if (!GITHUB_TOKEN) {
    console.warn('No GITHUB_TOKEN — skipping GitHub delete for', repoPath);
    return { ok: true, github: false };
  }

  console.log(`[deleteFileFromGitHub] path: ${repoPath}`);
  console.log(`[deleteFileFromGitHub] message: ${message}`);

  const sha = await getFileSha(repoPath);
  if (!sha) {
    console.log(`[deleteFileFromGitHub] no SHA found — file not on ${BRANCH}, skipping GitHub delete`);
    return { ok: true, github: false };
  }

  console.log(`[deleteFileFromGitHub] sending DELETE with sha: ${sha}`);
  const requestBody = { message, sha, branch: BRANCH };
  console.log(`[deleteFileFromGitHub] request body: ${JSON.stringify(requestBody)}`);

  const res = await githubRequest('DELETE', `/repos/${REPO}/contents/${repoPath}`, requestBody);

  console.log(`[deleteFileFromGitHub] GitHub response status: ${res.status}`);
  console.log(`[deleteFileFromGitHub] GitHub response body: ${JSON.stringify(res.data)}`);

  if (res.status !== 200) {
    throw new Error(`GitHub DELETE error ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return { ok: true, github: true };
}

// ── Frontmatter helpers ───────────────────────────────────────────────────────

function buildPropertyFrontmatter(d) {
  const lines = [
    '---',
    `slug: ${d.slug}`,
    `address: ${JSON.stringify(d.address)}`,
    `price: ${Number(d.price)}`,
    `beds: ${Number(d.beds)}`,
    `baths: ${Number(d.baths)}`,
    `sqft: ${Number(d.sqft)}`,
  ];

  if (d.hero) lines.push(`hero: ${JSON.stringify(d.hero)}`);

  if (d.gallery && d.gallery.length > 0) {
    lines.push('gallery:');
    for (const g of d.gallery) lines.push(`  - ${JSON.stringify(g)}`);
  }

  lines.push('description: |');
  for (const line of d.description.split('\n')) {
    lines.push('  ' + line);
  }

  lines.push('---');
  return lines.join('\n') + '\n';
}

function buildEventFrontmatter(d) {
  const lines = [
    '---',
    `property: ${d.property}`,
    `date: "${d.date}"`,
    `start: "${d.start}"`,
    `end: "${d.end}"`,
  ];
  if (d.notes && d.notes.trim()) lines.push(`notes: ${JSON.stringify(d.notes.trim())}`);
  lines.push('---');
  return lines.join('\n') + '\n';
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};
  const lines = yaml.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx < 1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    if (rest === '|' || rest === '>') {
      const blockLines = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        blockLines.push(lines[i].startsWith('  ') ? lines[i].slice(2) : '');
        i++;
      }
      result[key] = blockLines.join('\n').replace(/\n+$/, '');
      continue;
    }

    if (rest === '') {
      const arr = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('- ')) {
        arr.push(lines[j].trim().slice(2).replace(/^["']|["']$/g, ''));
        j++;
      }
      if (arr.length > 0) {
        result[key] = arr;
        i = j;
        continue;
      }
      result[key] = null;
    } else {
      const val = rest.replace(/^["']|["']$/g, '');
      result[key] = /^\d+(\.\d+)?$/.test(val) ? parseFloat(val) : val;
    }
    i++;
  }
  return result;
}

// ── File helpers ──────────────────────────────────────────────────────────────

function readLocalProperties() {
  const dir = path.join(REPO_ROOT, 'src/content/properties');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      const fm = parseFrontmatter(content);
      return { file: f, slug: fm.slug || f.replace('.md', ''), address: fm.address || '', ...fm };
    });
}

function readLocalEvents() {
  const dir = path.join(REPO_ROOT, 'src/content/events');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      const fm = parseFrontmatter(content);
      return { id: f.replace('.md', ''), file: f, ...fm };
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// ── Request body reader ───────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Serve admin UI
  if (method === 'GET' && pathname === '/') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // ── GET /api/properties ────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/properties') {
    const props = readLocalProperties().map(p => ({ slug: p.slug, address: p.address }));
    return jsonResponse(res, 200, props);
  }

  // ── GET /api/events ────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/events') {
    return jsonResponse(res, 200, readLocalEvents());
  }

  // ── GET /api/property/:slug  ───────────────────────────────────────────────
  // ── DELETE /api/property/:slug ─────────────────────────────────────────────
  const propMatch = pathname.match(/^\/api\/property\/(.+)$/);
  if (propMatch) {
    const slug = propMatch[1];

    if (method === 'GET') {
      const filePath = path.join(REPO_ROOT, `src/content/properties/${slug}.md`);
      if (!fs.existsSync(filePath)) return jsonResponse(res, 404, { error: 'Not found' });
      const fm = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
      return jsonResponse(res, 200, fm);
    }

    if (method === 'DELETE') {
      try {
        // Safety check: does any event reference this property?
        const events = readLocalEvents().filter(e => e.property === slug);
        if (events.length > 0) {
          return jsonResponse(res, 409, {
            error: `This property has ${events.length} event${events.length > 1 ? 's' : ''} referencing it. Delete those first.`,
            eventCount: events.length,
          });
        }

        const repoPath = `src/content/properties/${slug}.md`;
        const localPath = path.join(REPO_ROOT, repoPath);

        if (!fs.existsSync(localPath)) return jsonResponse(res, 404, { error: 'Not found' });

        fs.unlinkSync(localPath);
        const result = await deleteFileFromGitHub(repoPath, `content: delete property ${slug}`);
        return jsonResponse(res, 200, { ok: true, ...result });
      } catch (err) {
        console.error(err);
        return jsonResponse(res, 500, { error: err.message });
      }
    }
  }

  // ── GET /api/event/:id  ────────────────────────────────────────────────────
  // ── DELETE /api/event/:id ──────────────────────────────────────────────────
  const eventMatch = pathname.match(/^\/api\/event\/(.+)$/);
  if (eventMatch) {
    const id = eventMatch[1];

    if (method === 'GET') {
      const filePath = path.join(REPO_ROOT, `src/content/events/${id}.md`);
      if (!fs.existsSync(filePath)) return jsonResponse(res, 404, { error: 'Not found' });
      const fm = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
      return jsonResponse(res, 200, { id, ...fm });
    }

    if (method === 'DELETE') {
      try {
        console.log(`[DELETE event] id from URL: "${id}"`);
        const repoPath = `src/content/events/${id}.md`;
        const localPath = path.join(REPO_ROOT, repoPath);
        console.log(`[DELETE event] repoPath: "${repoPath}"`);
        console.log(`[DELETE event] localPath: "${localPath}"`);
        console.log(`[DELETE event] file exists locally: ${fs.existsSync(localPath)}`);

        if (!fs.existsSync(localPath)) return jsonResponse(res, 404, { error: 'Not found' });

        fs.unlinkSync(localPath);
        const result = await deleteFileFromGitHub(repoPath, `content: delete open house event ${id}`);
        return jsonResponse(res, 200, { ok: true, ...result });
      } catch (err) {
        console.error(err);
        return jsonResponse(res, 500, { error: err.message });
      }
    }
  }

  // ── POST /api/property ─────────────────────────────────────────────────────
  if (method === 'POST' && pathname === '/api/property') {
    try {
      const raw = await readBody(req);
      const d = JSON.parse(raw);
      if (!d.slug || !d.address) return jsonResponse(res, 400, { error: 'slug and address are required' });

      d.slug = d.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const repoPath = `src/content/properties/${d.slug}.md`;
      const localPath = path.join(REPO_ROOT, repoPath);
      const isNew = !fs.existsSync(localPath);

      const content = buildPropertyFrontmatter(d);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, content);

      const result = await commitFile(
        repoPath,
        content,
        `content: ${isNew ? 'add' : 'update'} property ${d.slug}`
      );
      return jsonResponse(res, 200, { ok: true, slug: d.slug, ...result });
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── POST /api/event ────────────────────────────────────────────────────────
  if (method === 'POST' && pathname === '/api/event') {
    try {
      const raw = await readBody(req);
      const d = JSON.parse(raw);
      if (!d.property || !d.date || !d.start || !d.end)
        return jsonResponse(res, 400, { error: 'property, date, start, end are required' });

      const newId = `${d.property}-${d.date}`;
      const originalId = d.originalId || null;
      const repoPath = `src/content/events/${newId}.md`;
      const localPath = path.join(REPO_ROOT, repoPath);
      const isNew = !fs.existsSync(localPath);

      const content = buildEventFrontmatter(d);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, content);

      // If the ID changed (date or property was edited), delete the old file
      if (originalId && originalId !== newId) {
        const oldRepoPath = `src/content/events/${originalId}.md`;
        const oldLocalPath = path.join(REPO_ROOT, oldRepoPath);
        if (fs.existsSync(oldLocalPath)) fs.unlinkSync(oldLocalPath);
        await deleteFileFromGitHub(oldRepoPath, `content: rename event ${originalId} → ${newId}`);
      }

      const result = await commitFile(
        repoPath,
        content,
        `content: ${isNew && !originalId ? 'add' : 'update'} open house event ${newId}`
      );
      return jsonResponse(res, 200, { ok: true, id: newId, ...result });
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── POST /api/upload ───────────────────────────────────────────────────────
  // Expects JSON: { slug, filename, data (base64), contentType }
  if (method === 'POST' && pathname === '/api/upload') {
    try {
      const raw = await readBody(req);
      const { slug, filename, data } = JSON.parse(raw);
      if (!slug || !filename || !data) return jsonResponse(res, 400, { error: 'slug, filename, data required' });

      const safeFilename = path.basename(filename).replace(/[^a-z0-9._-]/gi, '-');
      const repoPath = `public/uploads/${slug}/${safeFilename}`;
      const localPath = path.join(REPO_ROOT, repoPath);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

      if (GITHUB_TOKEN) {
        const sha = await getFileSha(repoPath);
        const body = { message: `content: upload photo for ${slug}`, content: data, branch: BRANCH };
        if (sha) body.sha = sha;
        const res2 = await githubRequest('PUT', `/repos/${REPO}/contents/${repoPath}`, body);
        if (res2.status !== 200 && res2.status !== 201) {
          throw new Error(`GitHub upload error ${res2.status}: ${JSON.stringify(res2.data)}`);
        }
      }

      return jsonResponse(res, 200, { ok: true, path: `/uploads/${slug}/${safeFilename}` });
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── POST /api/sync-all ─────────────────────────────────────────────────────
  // Commits every local property and event file to GitHub in one pass.
  // Also commits any photos found in public/uploads/.
  if (method === 'POST' && pathname === '/api/sync-all') {
    if (!GITHUB_TOKEN) {
      return jsonResponse(res, 400, { error: 'GITHUB_TOKEN not set — cannot sync to GitHub.' });
    }
    try {
      const results = { ok: [], failed: [] };

      // Collect all files to sync
      const filesToSync = [];

      // Properties
      const propDir = path.join(REPO_ROOT, 'src/content/properties');
      if (fs.existsSync(propDir)) {
        for (const f of fs.readdirSync(propDir).filter(f => f.endsWith('.md'))) {
          filesToSync.push({ repoPath: `src/content/properties/${f}`, localPath: path.join(propDir, f), binary: false });
        }
      }

      // Events
      const eventDir = path.join(REPO_ROOT, 'src/content/events');
      if (fs.existsSync(eventDir)) {
        for (const f of fs.readdirSync(eventDir).filter(f => f.endsWith('.md'))) {
          filesToSync.push({ repoPath: `src/content/events/${f}`, localPath: path.join(eventDir, f), binary: false });
        }
      }

      // Photos in public/uploads/
      const uploadsDir = path.join(REPO_ROOT, 'public/uploads');
      if (fs.existsSync(uploadsDir)) {
        for (const slug of fs.readdirSync(uploadsDir)) {
          const slugDir = path.join(uploadsDir, slug);
          if (!fs.statSync(slugDir).isDirectory()) continue;
          for (const f of fs.readdirSync(slugDir)) {
            if (f.startsWith('.')) continue;
            filesToSync.push({ repoPath: `public/uploads/${slug}/${f}`, localPath: path.join(slugDir, f), binary: true });
          }
        }
      }

      console.log(`[sync-all] ${filesToSync.length} files to sync`);

      for (const { repoPath, localPath, binary } of filesToSync) {
        try {
          const sha = await getFileSha(repoPath);
          let content, encodedContent;

          if (binary) {
            const buf = fs.readFileSync(localPath);
            encodedContent = buf.toString('base64');
            content = null; // not used for binary commitFile path
          } else {
            content = fs.readFileSync(localPath, 'utf8');
            encodedContent = Buffer.from(content).toString('base64');
          }

          const body = {
            message: `content: sync ${repoPath}`,
            content: encodedContent,
            branch: BRANCH,
          };
          if (sha) body.sha = sha;

          const ghRes = await githubRequest('PUT', `/repos/${REPO}/contents/${repoPath}`, body);
          if (ghRes.status !== 200 && ghRes.status !== 201) {
            throw new Error(`status ${ghRes.status}: ${JSON.stringify(ghRes.data)}`);
          }
          console.log(`[sync-all] ✓ ${repoPath}`);
          results.ok.push(repoPath);
        } catch (err) {
          console.error(`[sync-all] ✗ ${repoPath}: ${err.message}`);
          results.failed.push({ path: repoPath, error: err.message });
        }
      }

      return jsonResponse(res, 200, {
        ok: results.failed.length === 0,
        synced: results.ok.length,
        failed: results.failed.length,
        details: results,
      });
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\nBlue Gecko Admin running at http://localhost:${PORT}`);
  if (!GITHUB_TOKEN) {
    console.warn('⚠  GITHUB_TOKEN not set — files will be saved locally but NOT committed to GitHub.');
  } else {
    console.log('✓  GitHub token found — saves will commit to', REPO);
  }
  console.log('   Press Ctrl+C to stop.\n');
});
