/**
 * Blue Gecko Open House Admin Server
 * Plain Node.js — no framework, no extra dependencies.
 * Run: GITHUB_TOKEN=ghp_xxx node tools/open-house-admin/server.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const PORT = 3333;

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
  return res.status === 200 ? res.data.sha : null;
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

  // Multiline description using YAML literal block
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
      // Block scalar
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
      // Could be an array
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
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
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
    const events = readLocalEvents();
    return jsonResponse(res, 200, events);
  }

  // ── GET /api/property/:slug ────────────────────────────────────────────────
  const propMatch = pathname.match(/^\/api\/property\/(.+)$/);
  if (method === 'GET' && propMatch) {
    const slug = propMatch[1];
    const filePath = path.join(REPO_ROOT, `src/content/properties/${slug}.md`);
    if (!fs.existsSync(filePath)) return jsonResponse(res, 404, { error: 'Not found' });
    const fm = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
    return jsonResponse(res, 200, fm);
  }

  // ── GET /api/event/:id ─────────────────────────────────────────────────────
  const eventMatch = pathname.match(/^\/api\/event\/(.+)$/);
  if (method === 'GET' && eventMatch) {
    const id = eventMatch[1];
    const filePath = path.join(REPO_ROOT, `src/content/events/${id}.md`);
    if (!fs.existsSync(filePath)) return jsonResponse(res, 404, { error: 'Not found' });
    const fm = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
    return jsonResponse(res, 200, { id, ...fm });
  }

  // ── POST /api/property ─────────────────────────────────────────────────────
  if (method === 'POST' && pathname === '/api/property') {
    try {
      const raw = await readBody(req);
      const d = JSON.parse(raw);
      if (!d.slug || !d.address) return jsonResponse(res, 400, { error: 'slug and address are required' });

      // Normalize slug
      d.slug = d.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const content = buildPropertyFrontmatter(d);
      const localPath = path.join(REPO_ROOT, `src/content/properties/${d.slug}.md`);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, content);

      const result = await commitFile(
        `src/content/properties/${d.slug}.md`,
        content,
        `content: ${fs.existsSync(localPath) ? 'update' : 'add'} property ${d.slug}`
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

      const id = `${d.property}-${d.date}`;
      const content = buildEventFrontmatter(d);
      const localPath = path.join(REPO_ROOT, `src/content/events/${id}.md`);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, content);

      const result = await commitFile(
        `src/content/events/${id}.md`,
        content,
        `content: add open house event ${id}`
      );
      return jsonResponse(res, 200, { ok: true, id, ...result });
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
      const { slug, filename, data, contentType } = JSON.parse(raw);
      if (!slug || !filename || !data) return jsonResponse(res, 400, { error: 'slug, filename, data required' });

      const safeFilename = path.basename(filename).replace(/[^a-z0-9._-]/gi, '-');
      const repoPath = `public/uploads/${slug}/${safeFilename}`;
      const localPath = path.join(REPO_ROOT, repoPath);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

      const result = await commitFile(
        repoPath,
        Buffer.from(data, 'base64').toString('binary'),
        `content: upload photo for ${slug}`
      );

      // GitHub Contents API wants base64 directly; override with raw base64
      if (GITHUB_TOKEN) {
        const sha = await getFileSha(repoPath);
        const body = { message: `content: upload photo for ${slug}`, content: data, branch: BRANCH };
        if (sha) body.sha = sha;
        await githubRequest('PUT', `/repos/${REPO}/contents/${repoPath}`, body);
      }

      return jsonResponse(res, 200, { ok: true, path: `/${repoPath.replace('public/', '')}` });
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
