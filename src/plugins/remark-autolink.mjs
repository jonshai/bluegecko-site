/**
 * remark-autolink.mjs
 *
 * Build-time remark plugin that injects cross-links into Markdown content.
 * Configuration: src/data/link-targets.json
 * Builders and communities auto-register from their collection directories.
 *
 * Rules:
 *  - First mention of a phrase per document only
 *  - Never inside an existing link or heading node
 *  - Never a self-link
 *  - Cap: frontmatter.autolink_cap ?? 8 (999 for FAQ pages)
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { visit, CONTINUE } from 'unist-util-visit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// Load link-targets.json
// ---------------------------------------------------------------------------
const jsonPath = resolve(__dirname, '../data/link-targets.json');
let jsonTargets = { blog: [], builders: [], communities: [] };
try {
  jsonTargets = JSON.parse(readFileSync(jsonPath, 'utf-8'));
} catch (e) {
  console.warn('[remark-autolink] link-targets.json not found or invalid:', e.message);
}

// ---------------------------------------------------------------------------
// Parse frontmatter from raw markdown text (minimal YAML — name field only)
// ---------------------------------------------------------------------------
function extractNameFromFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const nameMatch = match[1].match(/^name:\s*"?([^"\n]+)"?\s*$/m);
  return nameMatch ? nameMatch[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Read collection entries directly from the filesystem
// ---------------------------------------------------------------------------
function readCollectionEntries(collectionPath, urlPrefix) {
  const entries = [];
  try {
    const files = readdirSync(collectionPath).filter(
      (f) => f.endsWith('.md') && f !== '.gitkeep'
    );
    for (const file of files) {
      try {
        const slug = basename(file, '.md');
        const content = readFileSync(join(collectionPath, file), 'utf-8');
        const name = extractNameFromFrontmatter(content);
        if (name) {
          entries.push({
            slug,
            url: `${urlPrefix}/${slug}`,
            title: name,
            link_target: true,
            aliases: [],
          });
        }
      } catch (e) {
        console.warn(`[remark-autolink] Could not read ${file}:`, e.message);
      }
    }
  } catch (e) {
    // Directory may not exist yet — silently skip
  }
  return entries;
}

const buildersFromFs = readCollectionEntries(
  resolve(projectRoot, 'src/content/builders'),
  '/builders'
);
const communitiesFromFs = readCollectionEntries(
  resolve(projectRoot, 'src/content/communities'),
  '/communities'
);

// ---------------------------------------------------------------------------
// Merge: filesystem entries are base; JSON entries can override aliases/link_target
// ---------------------------------------------------------------------------
function mergeEntries(fromJson, fromFs) {
  const merged = fromFs.map((e) => ({ ...e }));
  for (const jsonEntry of fromJson) {
    const existing = merged.find((e) => e.slug === jsonEntry.slug);
    if (existing) {
      existing.link_target = jsonEntry.link_target ?? existing.link_target;
      existing.aliases = jsonEntry.aliases ?? existing.aliases;
    } else {
      merged.push({ ...jsonEntry });
    }
  }
  return merged;
}

const allBuilders = mergeEntries(jsonTargets.builders || [], buildersFromFs);
const allCommunities = mergeEntries(jsonTargets.communities || [], communitiesFromFs);

// ---------------------------------------------------------------------------
// Build the global phrase map: lowercase phrase → { url, label }
// Sorted longest-first to prevent partial matches.
// ---------------------------------------------------------------------------
function buildGlobalLinkMap(blogEntries, builders, communities) {
  const map = new Map();

  function addEntry(entry) {
    if (!entry.link_target) return;
    const phrases = [entry.title, ...(entry.aliases || [])].filter(Boolean);
    for (const phrase of phrases) {
      const key = phrase.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { url: entry.url, label: phrase });
      }
    }
  }

  for (const e of blogEntries) addEntry(e);
  for (const e of builders) addEntry(e);
  for (const e of communities) addEntry(e);

  return new Map(
    [...map.entries()].sort((a, b) => b[0].length - a[0].length)
  );
}

const globalLinkMap = buildGlobalLinkMap(
  jsonTargets.blog || [],
  allBuilders,
  allCommunities
);

// ---------------------------------------------------------------------------
// Derive canonical URL from the source file path
// ---------------------------------------------------------------------------
function getPageUrl(filePath) {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  const match = normalized.match(/src\/content\/([^/]+)\/(.+)\.md$/);
  if (!match) return '';
  const [, collection, slug] = match;
  const prefixMap = {
    blog: '/blog',
    builders: '/builders',
    communities: '/communities',
    faq: '/faq',
  };
  const prefix = prefixMap[collection];
  if (!prefix) return '';
  return `${prefix}/${slug}`;
}

function isFaqFile(filePath) {
  return Boolean(filePath && filePath.replace(/\\/g, '/').includes('/content/faq/'));
}

// ---------------------------------------------------------------------------
// The remark plugin
// ---------------------------------------------------------------------------
export default function remarkAutolink() {
  return (tree, file) => {
    if (globalLinkMap.size === 0) return;

    const filePath = (file.history && file.history[0]) || '';
    const frontmatter = (file.data && file.data.astro && file.data.astro.frontmatter) || {};

    const defaultCap = isFaqFile(filePath) ? 999 : 8;
    const cap = frontmatter.autolink_cap != null ? frontmatter.autolink_cap : defaultCap;

    const pageUrl = getPageUrl(filePath);

    // Per-page link map: exclude self
    const pageLinkMap =
      pageUrl
        ? new Map([...globalLinkMap.entries()].filter(([, v]) => v.url !== pageUrl))
        : new Map(globalLinkMap);

    if (pageLinkMap.size === 0) return;

    const phrases = [...pageLinkMap.keys()]; // longest-first
    const linkedUrls = new Set(); // urls already injected in this document
    let totalLinks = 0;

    visit(tree, 'text', (node, index, parent) => {
      if (totalLinks >= cap) return;
      if (!parent || index == null) return;
      if (parent.type === 'link') return;
      if (parent.type === 'heading') return;

      const text = node.value;
      if (!text) return;

      const lowerText = text.toLowerCase();

      for (const phrase of phrases) {
        if (totalLinks >= cap) break;

        const target = pageLinkMap.get(phrase);
        if (linkedUrls.has(target.url)) continue;

        const idx = lowerText.indexOf(phrase);
        if (idx === -1) continue;

        // Word-boundary check: preceding and following chars must not be alphanumeric
        if (idx > 0 && /[a-zA-Z0-9]/.test(text[idx - 1])) continue;
        const afterIdx = idx + phrase.length;
        if (afterIdx < text.length && /[a-zA-Z0-9]/.test(text[afterIdx])) continue;

        // Build replacement nodes
        const matchedText = text.slice(idx, afterIdx);
        const beforeText = text.slice(0, idx);
        const afterText = text.slice(afterIdx);

        const newNodes = [];
        if (beforeText) newNodes.push({ type: 'text', value: beforeText });
        newNodes.push({
          type: 'link',
          url: target.url,
          title: null,
          children: [{ type: 'text', value: matchedText }],
        });
        if (afterText) newNodes.push({ type: 'text', value: afterText });

        parent.children.splice(index, 1, ...newNodes);

        linkedUrls.add(target.url);
        totalLinks++;

        // Continue from the afterText node (if any) so remaining text is scanned
        const nextIndex = index + newNodes.length - (afterText ? 1 : 0);
        return [CONTINUE, nextIndex];
      }
    });
  };
}
