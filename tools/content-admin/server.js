/**
 * Blue Gecko Content Admin Dashboard — Server
 * Port: 3334
 * Plain Node.js — no framework, no extra dependencies beyond Node built-ins.
 *
 * Setup: copy .env.example to .env, add GITHUB_TOKEN, then run:
 *   node tools/content-admin/server.js
 *
 * All content/asset data is read from GitHub API, never from local filesystem.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3334;
const REPO = 'jonshai/bluegecko-site';
const BRANCH = 'main';

// ── Load .env from tools/content-admin/.env (no dotenv dependency) ────────────
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

// Require token at startup — refuse to run in degraded mode
if (!GITHUB_TOKEN) {
  console.error('');
  console.error('ERROR: GITHUB_TOKEN is not set.');
  console.error('');
  console.error('This tool requires a GitHub personal access token to operate.');
  console.error('Steps:');
  console.error('  1. Copy tools/content-admin/.env.example to tools/content-admin/.env');
  console.error('  2. Generate a token at https://github.com/settings/tokens (classic, repo scope)');
  console.error('  3. Add: GITHUB_TOKEN=your_token_here');
  console.error('  4. Re-run: node tools/content-admin/server.js');
  console.error('');
  process.exit(1);
}

// ── GitHub API ─────────────────────────────────────────────────────────────────

function githubRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'bluegecko-content-admin/1.0',
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
  const res = await githubRequest('GET', `/repos/${REPO}/contents/${encodeURIComponent(repoPath)}?ref=${BRANCH}`);
  if (res.status !== 200) {
    console.log(`[getFileSha] ${repoPath} → status ${res.status}`);
    return null;
  }
  const sha = typeof res.data === 'object' && !Array.isArray(res.data) ? res.data.sha : null;
  if (!sha || typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha.trim())) {
    console.warn(`[getFileSha] unexpected sha for ${repoPath}:`, JSON.stringify(sha));
    return null;
  }
  return sha.trim();
}

async function putFile(repoPath, encodedContent, message) {
  let sha = await getFileSha(repoPath);

  const buildBody = (s) => {
    const body = { message, content: encodedContent, branch: BRANCH };
    if (s && /^[0-9a-f]{40}$/i.test(s.trim())) body.sha = s.trim();
    return body;
  };

  let ghRes = await githubRequest('PUT', `/repos/${REPO}/contents/${encodeURIComponent(repoPath)}`, buildBody(sha));

  // 409 = conflict, 422 = invalid SHA — re-fetch and retry once
  if (ghRes.status === 409 || ghRes.status === 422) {
    console.warn(`[putFile] ${ghRes.status} on first attempt for ${repoPath} — re-fetching SHA`);
    sha = await getFileSha(repoPath);
    ghRes = await githubRequest('PUT', `/repos/${REPO}/contents/${encodeURIComponent(repoPath)}`, buildBody(sha));
  }

  if (ghRes.status !== 200 && ghRes.status !== 201) {
    throw new Error(`GitHub PUT error ${ghRes.status} for ${repoPath}: ${JSON.stringify(ghRes.data)}`);
  }
  console.log(`[putFile] ✓ ${repoPath} (${ghRes.status})`);
  return { ok: true };
}

async function deleteFile(repoPath, message) {
  console.log(`[deleteFile] ${repoPath}`);
  const sha = await getFileSha(repoPath);
  if (!sha) {
    throw new Error(`File not found on ${BRANCH}: ${repoPath}`);
  }
  const res = await githubRequest('DELETE', `/repos/${REPO}/contents/${encodeURIComponent(repoPath)}`, {
    message,
    sha,
    branch: BRANCH,
  });
  if (res.status !== 200) {
    throw new Error(`GitHub DELETE error ${res.status}: ${JSON.stringify(res.data)}`);
  }
  console.log(`[deleteFile] ✓ deleted ${repoPath}`);
  return { ok: true };
}

// ── GitHub directory listing ───────────────────────────────────────────────────

async function listDirectory(repoPath) {
  const res = await githubRequest('GET', `/repos/${REPO}/contents/${encodeURIComponent(repoPath)}?ref=${BRANCH}`);
  if (res.status !== 200) return [];
  if (!Array.isArray(res.data)) return [];
  return res.data;
}

async function getFileContent(repoPath) {
  const res = await githubRequest('GET', `/repos/${REPO}/contents/${encodeURIComponent(repoPath)}?ref=${BRANCH}`);
  if (res.status !== 200) return null;
  if (typeof res.data !== 'object' || Array.isArray(res.data)) return null;
  const raw = res.data.content;
  if (!raw) return null;
  return Buffer.from(raw.replace(/\n/g, ''), 'base64').toString('utf8');
}

// ── Recursive tree fetch from GitHub ──────────────────────────────────────────

async function getRepoTree(treeSha) {
  const res = await githubRequest('GET', `/repos/${REPO}/git/trees/${treeSha}?recursive=1`);
  if (res.status !== 200) throw new Error(`Failed to fetch repo tree: ${res.status}`);
  return res.data;
}

async function getLatestCommitSha() {
  const res = await githubRequest('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
  if (res.status !== 200) throw new Error(`Failed to fetch branch ref: ${res.status}`);
  return res.data.object.sha;
}

async function getTreeShaForCommit(commitSha) {
  const res = await githubRequest('GET', `/repos/${REPO}/git/commits/${commitSha}`);
  if (res.status !== 200) throw new Error(`Failed to fetch commit: ${res.status}`);
  return res.data.tree.sha;
}

// ── Frontmatter parser ─────────────────────────────────────────────────────────

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
      // Could be an array or an object key with no value
      const arr = [];
      let j = i + 1;
      while (j < lines.length && lines[j].match(/^\s+-\s/)) {
        arr.push(lines[j].replace(/^\s+-\s/, '').replace(/^["']|["']$/g, '').trim());
        j++;
      }
      if (arr.length > 0) {
        result[key] = arr;
        i = j;
        continue;
      }
      // Inline array [a, b, c]
      result[key] = null;
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      // Inline array
      const inner = rest.slice(1, -1);
      result[key] = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      const val = rest.replace(/^["']|["']$/g, '');
      result[key] = /^\d+(\.\d+)?$/.test(val) ? parseFloat(val) : val;
    }
    i++;
  }
  return result;
}

function getTitleFromFrontmatter(fm, collection) {
  switch (collection) {
    case 'blog': return fm.title || '';
    case 'builders': return fm.name || '';
    case 'communities': return fm.name || '';
    case 'faq': return fm.question || '';
    case 'properties': return fm.address || '';
    case 'events': return `${fm.property || ''} — ${fm.date || ''}`;
    default: return fm.title || fm.name || fm.question || fm.address || '';
  }
}

// ── Collection directories ─────────────────────────────────────────────────────

const COLLECTIONS = {
  blog: 'src/content/blog',
  builders: 'src/content/builders',
  communities: 'src/content/communities',
  faq: 'src/content/faq',
  properties: 'src/content/properties',
  events: 'src/content/events',
};

// ── Caches ─────────────────────────────────────────────────────────────────────
// Asset cache: TTL 5 minutes
let assetCache = null;
let assetCacheTime = 0;
const ASSET_CACHE_TTL = 5 * 60 * 1000;

// ── Request helpers ────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ── Asset fetcher (shared between audit and optimizer) ─────────────────────────

async function fetchAllAssets(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && assetCache && (now - assetCacheTime) < ASSET_CACHE_TTL) {
    return assetCache;
  }

  // Get the full repo tree
  const commitSha = await getLatestCommitSha();
  const treeSha = await getTreeShaForCommit(commitSha);
  const tree = await getRepoTree(treeSha);

  // Filter to public/ files only
  const publicFiles = (tree.tree || []).filter(item =>
    item.type === 'blob' && item.path.startsWith('public/')
  );

  // Also grab all .md and .astro files for reference checking
  const textFiles = (tree.tree || []).filter(item =>
    item.type === 'blob' &&
    (item.path.endsWith('.md') || item.path.endsWith('.astro') || item.path.endsWith('.ts'))
  );

  // Build a set of all text file content (concatenated for reference checking)
  // We fetch text files lazily — just collect paths for now; do reference check per asset below
  const textFilePaths = textFiles.map(f => f.path);

  // Fetch content of all text files (in parallel, batched)
  const TEXT_BATCH = 10;
  const textContents = {};
  for (let i = 0; i < textFilePaths.length; i += TEXT_BATCH) {
    const batch = textFilePaths.slice(i, i + TEXT_BATCH);
    await Promise.all(batch.map(async (fp) => {
      const content = await getFileContent(fp);
      if (content) textContents[fp] = content;
    }));
  }

  const allTextContent = Object.values(textContents).join('\n');

  const assets = publicFiles.map(item => {
    const sizeKb = Math.round((item.size || 0) / 1024 * 10) / 10;
    const filename = path.basename(item.path);
    const ext = path.extname(filename).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext);

    // Check if referenced anywhere
    const referenced = allTextContent.includes(filename) ||
      allTextContent.includes(item.path.replace('public/', '/')) ||
      allTextContent.includes(item.path);

    return {
      path: item.path,
      filename,
      sizeKb,
      sizeBytes: item.size || 0,
      isImage,
      ext,
      sha: item.sha,
      referenced,
      rawUrl: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${item.path}`,
    };
  });

  assetCache = assets;
  assetCacheTime = now;
  return assets;
}

// ── GitHub Actions runs fetcher ────────────────────────────────────────────────

async function fetchWorkflowRuns() {
  const res = await githubRequest('GET', `/repos/${REPO}/actions/runs?per_page=10`);
  if (res.status !== 200) throw new Error(`Failed to fetch workflow runs: ${res.status}`);
  return res.data.workflow_runs || [];
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
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── Serve index.html ─────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Could not read index.html');
    }
    return;
  }

  // ── GET /api/content/:collection ─────────────────────────────────────────────
  // Lists all files in a content collection with parsed frontmatter
  const contentListMatch = pathname.match(/^\/api\/content\/([a-z]+)$/);
  if (method === 'GET' && contentListMatch) {
    const collection = contentListMatch[1];
    const dir = COLLECTIONS[collection];
    if (!dir) return jsonResponse(res, 400, { error: `Unknown collection: ${collection}` });

    try {
      const files = await listDirectory(dir);
      const mdFiles = files.filter(f => f.name.endsWith('.md') && f.type === 'file');

      const entries = await Promise.all(mdFiles.map(async (f) => {
        const content = await getFileContent(f.path);
        const fm = content ? parseFrontmatter(content) : {};
        const slug = f.name.replace('.md', '');
        return {
          slug,
          filename: f.name,
          path: f.path,
          sha: f.sha,
          size: f.size,
          title: getTitleFromFrontmatter(fm, collection),
          frontmatter: fm,
        };
      }));

      // Sort by date desc for blog/events, by slug for others
      if (collection === 'blog' || collection === 'events') {
        entries.sort((a, b) => (b.frontmatter.date || '').localeCompare(a.frontmatter.date || ''));
      } else {
        entries.sort((a, b) => a.slug.localeCompare(b.slug));
      }

      return jsonResponse(res, 200, entries);
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── DELETE /api/content/:collection/:slug ─────────────────────────────────────
  const contentDeleteMatch = pathname.match(/^\/api\/content\/([a-z]+)\/(.+)$/);
  if (method === 'DELETE' && contentDeleteMatch) {
    const collection = contentDeleteMatch[1];
    const slug = contentDeleteMatch[2];
    const dir = COLLECTIONS[collection];
    if (!dir) return jsonResponse(res, 400, { error: `Unknown collection: ${collection}` });

    try {
      const repoPath = `${dir}/${slug}.md`;
      await deleteFile(repoPath, `content: remove ${collection} entry ${slug}`);
      return jsonResponse(res, 200, { ok: true, deleted: repoPath });
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── GET /api/sitemap ──────────────────────────────────────────────────────────
  // Fetch all collections + static pages, build a route/cross-reference map
  if (method === 'GET' && pathname === '/api/sitemap') {
    try {
      const collectionKeys = Object.keys(COLLECTIONS);

      // Fetch all collection entries in parallel
      const collectionData = {};
      await Promise.all(collectionKeys.map(async (col) => {
        const dir = COLLECTIONS[col];
        const files = await listDirectory(dir);
        const mdFiles = files.filter(f => f.name.endsWith('.md') && f.type === 'file');
        const entries = await Promise.all(mdFiles.map(async (f) => {
          const content = await getFileContent(f.path);
          const fm = content ? parseFrontmatter(content) : {};
          const slug = f.name.replace('.md', '');
          return { slug, filename: f.name, path: f.path, title: getTitleFromFrontmatter(fm, col), frontmatter: fm };
        }));
        collectionData[col] = entries;
      }));

      // Fetch static pages directory listing
      const pagesRes = await githubRequest('GET', `/repos/${REPO}/git/trees/${BRANCH}?recursive=1`);
      const allFiles = pagesRes.status === 200 ? (pagesRes.data.tree || []) : [];
      const staticPages = allFiles
        .filter(f => f.path.startsWith('src/pages/') && f.path.endsWith('.astro') && f.type === 'blob')
        .map(f => {
          const rel = f.path.replace('src/pages/', '');
          let route = '/' + rel.replace(/\.astro$/, '').replace(/\/index$/, '').replace(/index$/, '');
          if (route !== '/' && route.endsWith('/')) route = route.slice(0, -1);
          if (route === '') route = '/';
          return { path: f.path, route, isDynamic: route.includes('[') };
        });

      // Build inbound link map: which slugs are referenced from other content
      const inboundLinks = {}; // key: "collection/slug", value: array of referencing paths

      for (const [col, entries] of Object.entries(collectionData)) {
        for (const entry of entries) {
          const fm = entry.frontmatter;
          // Check communities array in builders
          if (Array.isArray(fm.communities)) {
            for (const commSlug of fm.communities) {
              const key = `communities/${commSlug}`;
              if (!inboundLinks[key]) inboundLinks[key] = [];
              inboundLinks[key].push(`${col}/${entry.slug}`);
            }
          }
          // Check property reference in events
          if (fm.property) {
            const key = `properties/${fm.property}`;
            if (!inboundLinks[key]) inboundLinks[key] = [];
            inboundLinks[key].push(`${col}/${entry.slug}`);
          }
          // Check tags (loose cross-ref by name, not slug)
          if (Array.isArray(fm.tags)) {
            // tags are human-readable, just note them
          }
        }
      }

      // Determine orphans: content with no inbound links
      const orphans = [];
      for (const [col, entries] of Object.entries(collectionData)) {
        for (const entry of entries) {
          const key = `${col}/${entry.slug}`;
          const hasInbound = !!(inboundLinks[key] && inboundLinks[key].length > 0);
          // Collections that are always reachable via nav index pages: blog, builders, communities, faq
          const alwaysReachable = ['blog', 'builders', 'communities', 'faq'].includes(col);
          if (!hasInbound && !alwaysReachable) {
            orphans.push(key);
          }
        }
      }

      return jsonResponse(res, 200, {
        collections: collectionData,
        staticPages,
        inboundLinks,
        orphans,
      });
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── GET /api/assets ───────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/assets') {
    try {
      const refresh = url.searchParams.get('refresh') === '1';
      const assets = await fetchAllAssets(refresh);
      return jsonResponse(res, 200, assets);
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── GET /api/repo/search?q=term ───────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/repo/search') {
    const q = url.searchParams.get('q');
    if (!q || q.trim().length < 2) return jsonResponse(res, 400, { error: 'q param required (min 2 chars)' });

    try {
      // GitHub code search API
      const encoded = encodeURIComponent(`${q} repo:${REPO}`);
      const res2 = await githubRequest('GET', `/search/code?q=${encoded}&per_page=20`);
      if (res2.status !== 200) {
        return jsonResponse(res, 500, { error: `GitHub search error: ${res2.status}` });
      }
      return jsonResponse(res, 200, res2.data);
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── GET /api/deploy/runs ──────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/deploy/runs') {
    try {
      const runs = await fetchWorkflowRuns();
      const formatted = runs.map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,          // queued | in_progress | completed
        conclusion: r.conclusion,  // success | failure | cancelled | null
        event: r.event,            // push | workflow_dispatch | etc.
        branch: r.head_branch,
        commitMessage: r.head_commit?.message?.split('\n')[0] || '',
        commitSha: r.head_sha?.slice(0, 7) || '',
        startedAt: r.run_started_at,
        updatedAt: r.updated_at,
        htmlUrl: r.html_url,
        durationMs: r.run_started_at && r.updated_at
          ? new Date(r.updated_at) - new Date(r.run_started_at)
          : null,
      }));
      return jsonResponse(res, 200, formatted);
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── PUT /api/assets/* ─────────────────────────────────────────────────────────
  // Body: { content: base64, oldSizeKb: number, newSizeKb: number }
  const assetPutMatch = pathname.match(/^\/api\/assets\/(.+)$/);
  if (method === 'PUT' && assetPutMatch) {
    const assetPath = decodeURIComponent(assetPutMatch[1]);
    // Security: must be under public/
    if (!assetPath.startsWith('public/')) {
      return jsonResponse(res, 403, { error: 'Only public/ assets can be updated' });
    }

    try {
      const raw = await readBody(req);
      const { content, oldSizeKb, newSizeKb } = JSON.parse(raw);
      if (!content) return jsonResponse(res, 400, { error: 'content (base64) required' });

      const filename = path.basename(assetPath);
      const msg = `assets: optimize ${filename} (${oldSizeKb}KB → ${newSizeKb}KB)`;
      await putFile(assetPath, content, msg);

      // Invalidate asset cache
      assetCache = null;

      return jsonResponse(res, 200, { ok: true, path: assetPath });
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ── GET /api/proxy-image?path=public/... ─────────────────────────────────────
  // Proxies a file from GitHub Contents API to avoid CORS on raw.githubusercontent.com
  if (method === 'GET' && pathname === '/api/proxy-image') {
    const filePath = url.searchParams.get('path');
    if (!filePath) return jsonResponse(res, 400, { error: 'path param required' });
    if (!filePath.startsWith('public/')) return jsonResponse(res, 403, { error: 'Only public/ assets allowed' });

    try {
      // Encode each path segment individually — encodeURIComponent on the full path
      // encodes slashes as %2F, which GitHub's API treats as a single opaque segment.
      const encodedFilePath = filePath.split('/').map(encodeURIComponent).join('/');
      const ghRes = await githubRequest('GET', `/repos/${REPO}/contents/${encodedFilePath}?ref=${BRANCH}`);
      if (ghRes.status !== 200) {
        return jsonResponse(res, ghRes.status, { error: `GitHub returned ${ghRes.status}` });
      }

      // GitHub Contents API returns content:null for files over ~1MB.
      // Fall back to the Git Blobs API (no size limit) using the sha from the response.
      let rawContent = ghRes.data.content;
      if (!rawContent && ghRes.data.sha) {
        const blobRes = await githubRequest('GET', `/repos/${REPO}/git/blobs/${ghRes.data.sha}`);
        if (blobRes.status !== 200) {
          return jsonResponse(res, 502, { error: `Blob API returned ${blobRes.status}` });
        }
        rawContent = blobRes.data.content;
      }
      if (!rawContent) return jsonResponse(res, 404, { error: 'No content returned from GitHub' });

      const binary = Buffer.from(rawContent.replace(/\n/g, ''), 'base64');
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === '.png'  ? 'image/png'
        : ext === '.gif'  ? 'image/gif'
        : ext === '.webp' ? 'image/webp'
        : ext === '.svg'  ? 'image/svg+xml'
        : 'image/jpeg';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': binary.length,
        'Cache-Control': 'public, max-age=300',
      });
      res.end(binary);
    } catch (err) {
      console.error(err);
      return jsonResponse(res, 500, { error: err.message });
    }
    return;
  }

  // ── GET /health ───────────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/health') {
    return jsonResponse(res, 200, { status: 'ok' });
  }

  // 404 for unmatched routes
  return jsonResponse(res, 404, { error: 'Not found' });
});

server.listen(PORT, async () => {
  console.log('');
  console.log('Blue Gecko Content Admin Dashboard');
  console.log(`Running at http://localhost:${PORT}`);
  console.log(`GitHub repo: ${REPO} (branch: ${BRANCH})`);
  console.log('Press Ctrl+C to stop.');
  console.log('');

  // Startup auth check
  try {
    const check = await githubRequest('GET', `/repos/${REPO}`);
    if (check.status === 200) {
      console.log('[auth] GitHub API auth OK');
    } else if (check.status === 401) {
      console.error('[auth] ERROR: GITHUB_TOKEN is invalid or missing required scopes. Needs: repo, actions:read');
    } else if (check.status === 403) {
      console.error(`[auth] ERROR: GITHUB_TOKEN lacks permission (403). Ensure it has repo and actions:read scopes.`);
    } else {
      console.warn(`[auth] GitHub API check returned status ${check.status}`);
    }
  } catch (err) {
    console.error('[auth] ERROR: Could not reach GitHub API:', err.message);
  }
  console.log('');
});
