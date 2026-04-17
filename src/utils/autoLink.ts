// Build-time auto-linking utility
// Injects internal links based on entities.json

import entitiesData from '../data/entities.json';

type Entity = {
  name: string;
  type?: string;
  slug: string;
  aliases?: string[];
};

const entities: Entity[] = [...entitiesData.entities].sort((a, b) => {
  const typeWeight = (entity: Entity) => {
    if (entity.type === 'builder') return 3;
    if (entity.type === 'community') return 2;
    if (entity.type === 'municipality') return 1;
    return 0;
  };

  const aLongest = Math.max(a.name.length, ...(a.aliases || []).map((alias) => alias.length));
  const bLongest = Math.max(b.name.length, ...(b.aliases || []).map((alias) => alias.length));

  if (typeWeight(a) !== typeWeight(b)) {
    return typeWeight(b) - typeWeight(a);
  }

  return bLongest - aLongest;
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitProtectedSegments(content: string): { text: string; protected: boolean }[] {
  const protectedRegex = /(<a\b[^>]*>[\s\S]*?<\/a>|<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>|<code\b[^>]*>[\s\S]*?<\/code>|<pre\b[^>]*>[\s\S]*?<\/pre>)/gi;
  const segments: { text: string; protected: boolean }[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = protectedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, match.index), protected: false });
    }

    segments.push({ text: match[0], protected: true });
    lastIndex = protectedRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), protected: false });
  }

  return segments;
}

export function autoLink(content: string): string {
  if (!content) return content;

  const usedEntities = new Set<string>();
  let totalLinks = 0;
  const MAX_LINKS = 8;

  const segments = splitProtectedSegments(content);

  const linkedSegments = segments.map((segment) => {
    if (segment.protected || totalLinks >= MAX_LINKS) {
      return segment.text;
    }

    let text = segment.text;

    for (const entity of entities) {
      if (totalLinks >= MAX_LINKS) break;
      if (usedEntities.has(entity.name)) continue;

      const variants = [entity.name, ...(entity.aliases || [])].sort((a, b) => b.length - a.length);

      for (const variant of variants) {
        const escaped = escapeRegex(variant);
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');

        if (regex.test(text)) {
          text = text.replace(regex, (match) => {
            usedEntities.add(entity.name);
            totalLinks++;
            return `<a href="${entity.slug}">${match}</a>`;
          });
          break;
        }
      }
    }

    return text;
  });

  return linkedSegments.join('');
}