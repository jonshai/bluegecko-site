/**
 * Blue Gecko Prospecting Engine Admin — Server
 * Port: 3335. Plain Node.js — no framework, no extra dependencies.
 * Setup: copy .env.example to .env, add GITHUB_TOKEN, then run:
 *   node tools/prospecting-engine-admin/server.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const PORT = 3335;

// ── Load .env from tools/prospecting-engine-admin/.env ───────────────────────
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

// ── GitHub API ─────────────────────────────────────────────────────────────────

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
        'User-Agent': 'bluegecko-pea/1.0',
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
    console.log(`[getFileSha] ${repoPath} → status ${res.status}`);
    return null;
  }
  const sha = typeof res.data === 'object' && !Array.isArray(res.data) ? res.data.sha : null;
  if (!sha || typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha.trim())) {
    console.warn(`[getFileSha] unexpected sha for ${repoPath}:`, JSON.stringify(sha));
    return null;
  }
  console.log(`[getFileSha] ${repoPath} → sha ${sha}`);
  return sha.trim();
}

async function putFile(repoPath, encodedContent, message) {
  // Fetch current SHA — validates to 40-char hex or returns null (new file)
  let sha = await getFileSha(repoPath);

  const buildBody = (s) => {
    const body = { message, content: encodedContent, branch: BRANCH };
    if (s && /^[0-9a-f]{40}$/i.test(s.trim())) body.sha = s.trim();
    return body;
  };

  let ghRes = await githubRequest('PUT', `/repos/${REPO}/contents/${repoPath}`, buildBody(sha));

  // 409 = stale SHA (race condition), 422 = invalid SHA — re-fetch and retry once
  if (ghRes.status === 409 || ghRes.status === 422) {
    console.warn(`[putFile] ${ghRes.status} on first attempt for ${repoPath} — re-fetching SHA and retrying`);
    sha = await getFileSha(repoPath);
    ghRes = await githubRequest('PUT', `/repos/${REPO}/contents/${repoPath}`, buildBody(sha));
  }

  if (ghRes.status !== 200 && ghRes.status !== 201) {
    throw new Error(`GitHub PUT error ${ghRes.status} for ${repoPath}: ${JSON.stringify(ghRes.data)}`);
  }
  console.log(`[putFile] ✓ ${repoPath} (${ghRes.status})`);
  return { ok: true, github: true };
}

async function commitFile(repoPath, content, message) {
  if (!GITHUB_TOKEN) {
    console.warn('No GITHUB_TOKEN — skipping GitHub commit for', repoPath);
    return { ok: true, github: false };
  }
  const encoded = Buffer.from(content).toString('base64');
  return putFile(repoPath, encoded, message);
}

async function uploadImage(repoPath, base64Data, slug) {
  const localPath = path.join(REPO_ROOT, repoPath);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, Buffer.from(base64Data, 'base64'));
  if (GITHUB_TOKEN) {
    await putFile(repoPath, base64Data, `feat: upload image for prospecting ${slug}`);
  }
}

// ── YAML parser ────────────────────────────────────────────────────────────────
// Handles the PEA paste schema: simple key: value pairs, quoted values,
// and multiline literal block scalars (key: |).

function parsePeaYaml(yaml) {
  const result = {};
  const lines = yaml.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }

    const colonIdx = line.indexOf(':');
    if (colonIdx < 1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    if (rest === '|' || rest === '|-' || rest === '|+') {
      // Literal block scalar — collect indented lines
      const blockLines = [];
      i++;
      while (i < lines.length) {
        const bl = lines[i];
        if (bl.startsWith('  ') || bl === '') {
          blockLines.push(bl.startsWith('  ') ? bl.slice(2) : '');
          i++;
        } else {
          break;
        }
      }
      // Strip trailing empty lines
      while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '') {
        blockLines.pop();
      }
      result[key] = blockLines.join('\n');
      continue;
    }

    // Inline value — strip surrounding quotes
    result[key] = rest.replace(/^["']|["']$/g, '');
    i++;
  }

  return result;
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateFields(parsed, p1Hero, p6Enabled, p6Hero) {
  const errors = [];
  const required = ['slug', 'prospect_name', 'address', 'headline', 'cma_range', 'body_copy'];
  for (const f of required) {
    if (!parsed[f] || !String(parsed[f]).trim()) {
      errors.push(`Missing required field: ${f}`);
    }
  }
  if (!p1Hero) errors.push('P1 hero image is required');
  if (p6Enabled) {
    if (!parsed.p6_headline || !String(parsed.p6_headline).trim()) {
      errors.push('P6 toggle is ON but p6_headline is missing from the paste');
    }
    if (!parsed.p6_body_copy || !String(parsed.p6_body_copy).trim()) {
      errors.push('P6 toggle is ON but p6_body_copy is missing from the paste');
    }
    if (!p6Hero) {
      errors.push('P6 toggle is ON but no P6 hero image was uploaded');
    }
  }
  return errors;
}

// ── Content file builder ───────────────────────────────────────────────────────

function addOneYear(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

function buildProspectingMd({ slug, prospectName, address, agent, headline, cmaRange,
                              pubDate, expiryDate, heroImage, galleryImages, bodyCopy }) {
  const lines = [
    '---',
    `slug: ${slug}`,
    `prospect_name: ${JSON.stringify(prospectName)}`,
    `address: ${JSON.stringify(address)}`,
    `agent: ${JSON.stringify(agent)}`,
    `headline: ${JSON.stringify(headline)}`,
    `cma_range: ${JSON.stringify(cmaRange)}`,
    `pub_date: ${pubDate}`,
    `expiry_date: ${expiryDate}`,
    `hero_image: ${JSON.stringify(heroImage)}`,
    `noindex: true`,
  ];

  if (galleryImages && galleryImages.length > 0) {
    lines.push('gallery_images:');
    for (const g of galleryImages) {
      lines.push(`  - ${JSON.stringify(g)}`);
    }
  }

  lines.push('---');
  lines.push('');
  lines.push(bodyCopy.trim());
  lines.push('');

  return lines.join('\n');
}

// ── Request body reader ────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ── HTTP server ────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Admin UI
  if (method === 'GET' && pathname === '/') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Static files from public/ (for image preview)
  if (method === 'GET' && !pathname.startsWith('/api/')) {
    const mimeTypes = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    };
    const filePath = path.join(REPO_ROOT, 'public', pathname);
    const ext = path.extname(filePath).toLowerCase();
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const mime = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // ── POST /api/publish ──────────────────────────────────────────────────────
  // Body JSON: {
  //   yaml_paste: string,
  //   p1_hero: { name: string, data: base64 },
  //   p1_gallery: [{ name: string, data: base64 }],
  //   p6_enabled: boolean,
  //   p6_hero: { name: string, data: base64 } | null,
  //   p6_gallery: [{ name: string, data: base64 }],
  // }
  if (method === 'POST' && pathname === '/api/publish') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw);
      const { yaml_paste, p1_hero, p1_gallery = [], p6_enabled, p6_hero, p6_gallery = [] } = payload;

      if (!yaml_paste) return jsonResponse(res, 400, { error: 'yaml_paste is required' });

      // Parse YAML paste block
      const parsed = parsePeaYaml(yaml_paste);
      console.log('[publish] Parsed YAML fields:', Object.keys(parsed).join(', '));

      // Validate
      const errors = validateFields(parsed, p1_hero, p6_enabled, p6_hero);
      if (errors.length > 0) {
        return jsonResponse(res, 400, { error: errors.join('\n') });
      }

      // Normalise slug
      const slug = parsed.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const agent = (parsed.agent || 'William Whipple').trim();
      const pubDate = new Date().toISOString().split('T')[0];
      const expiryDate = (parsed.expiry_date || '').trim() || addOneYear(pubDate);

      // ── Page 1 ─────────────────────────────────────────────────────────────

      const p1HeroExt = path.extname(p1_hero.name).toLowerCase() || '.jpg';
      const p1HeroRepo = `public/images/prospecting/${slug}/hero${p1HeroExt}`;
      console.log(`[publish] Uploading P1 hero → ${p1HeroRepo}`);
      await uploadImage(p1HeroRepo, p1_hero.data, slug);

      const p1GalleryPaths = [];
      for (let i = 0; i < p1_gallery.length; i++) {
        const gExt = path.extname(p1_gallery[i].name).toLowerCase() || '.jpg';
        const gRepo = `public/images/prospecting/${slug}/gallery-${i + 1}${gExt}`;
        console.log(`[publish] Uploading P1 gallery ${i + 1} → ${gRepo}`);
        await uploadImage(gRepo, p1_gallery[i].data, slug);
        p1GalleryPaths.push(`/images/prospecting/${slug}/gallery-${i + 1}${gExt}`);
      }

      const p1Md = buildProspectingMd({
        slug,
        prospectName: parsed.prospect_name,
        address: parsed.address,
        agent,
        headline: parsed.headline,
        cmaRange: parsed.cma_range,
        pubDate,
        expiryDate,
        heroImage: `/images/prospecting/${slug}/hero${p1HeroExt}`,
        galleryImages: p1GalleryPaths,
        bodyCopy: parsed.body_copy,
      });

      const p1RepoPath = `src/content/prospecting/${slug}.md`;
      const p1LocalPath = path.join(REPO_ROOT, p1RepoPath);
      fs.mkdirSync(path.dirname(p1LocalPath), { recursive: true });
      fs.writeFileSync(p1LocalPath, p1Md);
      console.log(`[publish] Committing ${p1RepoPath}`);
      await commitFile(p1RepoPath, p1Md, `feat: publish prospecting page ${slug}`);

      // ── Page 6 (optional) ──────────────────────────────────────────────────

      let p6Slug = null;
      if (p6_enabled && p6_hero) {
        p6Slug = `${slug}-6`;

        const p6HeroExt = path.extname(p6_hero.name).toLowerCase() || '.jpg';
        const p6HeroRepo = `public/images/prospecting/${p6Slug}/hero${p6HeroExt}`;
        console.log(`[publish] Uploading P6 hero → ${p6HeroRepo}`);
        await uploadImage(p6HeroRepo, p6_hero.data, p6Slug);

        const p6GalleryPaths = [];
        for (let i = 0; i < p6_gallery.length; i++) {
          const gExt = path.extname(p6_gallery[i].name).toLowerCase() || '.jpg';
          const gRepo = `public/images/prospecting/${p6Slug}/gallery-${i + 1}${gExt}`;
          console.log(`[publish] Uploading P6 gallery ${i + 1} → ${gRepo}`);
          await uploadImage(gRepo, p6_gallery[i].data, p6Slug);
          p6GalleryPaths.push(`/images/prospecting/${p6Slug}/gallery-${i + 1}${gExt}`);
        }

        const p6Md = buildProspectingMd({
          slug: p6Slug,
          prospectName: parsed.prospect_name,
          address: parsed.address,
          agent,
          headline: parsed.p6_headline,
          cmaRange: parsed.cma_range,
          pubDate,
          expiryDate,
          heroImage: `/images/prospecting/${p6Slug}/hero${p6HeroExt}`,
          galleryImages: p6GalleryPaths,
          bodyCopy: parsed.p6_body_copy,
        });

        const p6RepoPath = `src/content/prospecting/${p6Slug}.md`;
        const p6LocalPath = path.join(REPO_ROOT, p6RepoPath);
        fs.mkdirSync(path.dirname(p6LocalPath), { recursive: true });
        fs.writeFileSync(p6LocalPath, p6Md);
        console.log(`[publish] Committing ${p6RepoPath}`);
        await commitFile(p6RepoPath, p6Md, `feat: publish prospecting page ${p6Slug}`);
      }

      const urls = [`https://bluegecko.homes/p/${slug}`];
      if (p6Slug) urls.push(`https://bluegecko.homes/p/${p6Slug}`);

      console.log('[publish] Done. Live URLs:', urls.join(', '));
      return jsonResponse(res, 200, { ok: true, slug, p6Slug, urls });

    } catch (err) {
      console.error('[publish] Error:', err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── GET /health ────────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/health') {
    return jsonResponse(res, 200, { status: 'ok' });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('\nBlue Gecko Prospecting Engine Admin');
  console.log(`Running at http://localhost:${PORT}`);
  if (!GITHUB_TOKEN) {
    console.warn('⚠  GITHUB_TOKEN not set — files will be saved locally but NOT committed to GitHub.');
  } else {
    console.log('✓  GitHub token found — publishes will commit to', REPO);
  }
  console.log('   Press Ctrl+C to stop.\n');
});
