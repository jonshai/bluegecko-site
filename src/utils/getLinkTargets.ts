// Synchronous utility that mirrors the link-map construction in remark-autolink.mjs.
// Used by builder pages (which use custom HTML rendering, not the remark pipeline).
// Uses Vite's import.meta.glob instead of fs (required for Cloudflare Workers prerender context).
// Keep this logic in sync with remark-autolink.mjs so both systems use identical maps.

import jsonTargets from '../data/link-targets.json';

// Vite resolves these glob patterns at bundle time — eager: true makes them synchronous.
// Paths are relative to this file (src/utils/), so these expand to src/content/...
const builderMdFiles = import.meta.glob('../content/builders/*.md', {
  eager: true,
  as: 'raw',
}) as Record<string, string>;

const communityMdFiles = import.meta.glob('../content/communities/*.md', {
  eager: true,
  as: 'raw',
}) as Record<string, string>;

type JsonEntry = {
  slug: string;
  url: string;
  title: string;
  link_target: boolean;
  aliases: string[];
};

export type LinkTarget = {
  url: string;
  label: string;
};

// Minimal frontmatter parser — extracts only the `name` field (same as remark plugin).
function extractNameFromFrontmatter(content: string): string | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const nameMatch = match[1].match(/^name:\s*"?([^"\n]+)"?\s*$/m);
  return nameMatch ? nameMatch[1].trim() : null;
}

// Convert glob result (path → raw content) into stub entries.
function entriesFromGlob(files: Record<string, string>, urlPrefix: string): JsonEntry[] {
  return Object.entries(files)
    .map(([path, content]) => {
      const filename = path.split('/').pop() ?? '';
      const slug = filename.replace(/\.md$/, '');
      if (!slug || slug === '.gitkeep') return null;
      const name = extractNameFromFrontmatter(content);
      if (!name) return null;
      return { slug, url: `${urlPrefix}/${slug}`, title: name, link_target: true, aliases: [] as string[] };
    })
    .filter((e): e is JsonEntry => e !== null);
}

// Merge: filesystem entries are the base; JSON entries can override aliases/link_target
// or contribute new entries that have no .md file (e.g. DR Horton).
// Identical to mergeEntries() in remark-autolink.mjs.
function mergeEntries(fromJson: JsonEntry[], fromFs: JsonEntry[]): JsonEntry[] {
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

function addToMap(map: Map<string, LinkTarget>, entry: JsonEntry) {
  if (!entry.link_target) return;
  const phrases = [entry.title, ...(entry.aliases ?? [])].filter(Boolean);
  for (const phrase of phrases) {
    const key = phrase.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { url: entry.url, label: phrase });
    }
  }
}

/**
 * Build and return the global link map used to inject cross-links into builder prose.
 *
 * Returns Map<lowercase phrase, {url, label}> sorted longest-phrase-first,
 * identical to what remark-autolink.mjs builds at remark pipeline time.
 */
export function getLinkTargets(): Map<string, LinkTarget> {
  const buildersFromFs = entriesFromGlob(builderMdFiles, '/builders');
  const communitiesFromFs = entriesFromGlob(communityMdFiles, '/communities');

  const allBuilders = mergeEntries((jsonTargets.builders ?? []) as JsonEntry[], buildersFromFs);
  const allCommunities = mergeEntries((jsonTargets.communities ?? []) as JsonEntry[], communitiesFromFs);

  const map = new Map<string, LinkTarget>();

  // Same order as remark's buildGlobalLinkMap()
  for (const e of (jsonTargets.blog ?? []) as JsonEntry[]) addToMap(map, e);
  for (const e of allBuilders) addToMap(map, e);
  for (const e of allCommunities) addToMap(map, e);
  for (const e of (jsonTargets.municipalities ?? []) as JsonEntry[]) addToMap(map, e);

  // Sort longest phrase first to prevent partial matches
  return new Map(
    [...map.entries()].sort((a, b) => b[0].length - a[0].length)
  );
}
