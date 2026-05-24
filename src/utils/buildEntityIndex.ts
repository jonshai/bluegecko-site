// Build-time utility: generates a sorted entity index from content collections
// plus supplement entities from entities.json (municipalities, unbuilt builders).

import { getCollection } from 'astro:content';
import supplementData from '../data/entities.json';

export type Entity = {
  name: string;
  type?: string;
  slug: string;
  aliases?: string[];
  priority?: number;
};

function priorityFor(type: string | undefined): number {
  if (type === 'builder') return 3;
  if (type === 'community') return 2;
  if (type === 'faq' || type === 'municipality') return 1;
  return 0; // blog and unknown
}

export async function buildEntityIndex(): Promise<Entity[]> {
  const [builders, communities, faqEntries, blogPosts] = await Promise.all([
    getCollection('builders'),
    getCollection('communities'),
    getCollection('faq'),
    getCollection('blog'),
  ]);

  const collectionEntities: Entity[] = [];

  for (const entry of builders) {
    collectionEntities.push({
      name: entry.data.name,
      slug: `/builders/${entry.id}/`,
      aliases: (entry.data as Record<string, unknown>).aliases as string[] | undefined ?? [],
      type: 'builder',
      priority: 3,
    });
  }

  for (const entry of communities) {
    collectionEntities.push({
      name: entry.data.name,
      slug: `/communities/${entry.id}/`,
      aliases: (entry.data as Record<string, unknown>).aliases as string[] | undefined ?? [],
      type: 'community',
      priority: 2,
    });
  }

  for (const entry of faqEntries) {
    collectionEntities.push({
      name: entry.data.question,
      slug: `/faq/${entry.id}/`,
      aliases: (entry.data as Record<string, unknown>).aliases as string[] | undefined ?? [],
      type: 'faq',
      priority: 1,
    });
  }

  for (const entry of blogPosts) {
    collectionEntities.push({
      name: entry.data.title,
      slug: `/blog/${entry.id}/`,
      aliases: (entry.data as Record<string, unknown>).aliases as string[] | undefined ?? [],
      type: 'blog',
      priority: 0,
    });
  }

  // Supplement entities: municipalities and builders without collection pages
  const supplementEntities: Entity[] = (supplementData.entities as Entity[]).map((e) => ({
    ...e,
    priority: priorityFor(e.type),
  }));

  // Merge: collection entries win over supplement entries with the same name
  const byName = new Map<string, Entity>();
  for (const e of supplementEntities) {
    byName.set(e.name.toLowerCase(), e);
  }
  for (const e of collectionEntities) {
    byName.set(e.name.toLowerCase(), e);
  }

  const merged = [...byName.values()];

  // Sort: priority descending, then longest name/alias descending (longest-match-first)
  merged.sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pa !== pb) return pb - pa;
    const aLen = Math.max(a.name.length, ...(a.aliases?.map((s) => s.length) ?? [0]));
    const bLen = Math.max(b.name.length, ...(b.aliases?.map((s) => s.length) ?? [0]));
    return bLen - aLen;
  });

  return merged;
}
