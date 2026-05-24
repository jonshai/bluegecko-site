// Build-time auto-linking utility.
// Entities are passed in (from buildEntityIndex) rather than imported statically.
// Call autoLink(html, entities, excludeSlug) on assembled HTML strings.

export type Entity = {
  name: string;
  type?: string;
  slug: string;
  aliases?: string[];
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns segments with protected blocks flagged so they are never modified.
// Protected: existing <a>, headings <h1-6>, list blocks <ul>, <code>, <pre>.
function splitProtectedSegments(content: string): { text: string; protected: boolean }[] {
  const protectedRegex =
    /(<a\b[^>]*>[\s\S]*?<\/a>|<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>|<ul\b[^>]*>[\s\S]*?<\/ul>|<code\b[^>]*>[\s\S]*?<\/code>|<pre\b[^>]*>[\s\S]*?<\/pre>)/gi;
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

/**
 * Inject internal links into an HTML string.
 *
 * @param content    The HTML to process (paragraph text; headings/lists/code are skipped).
 * @param entities   Sorted entity list from buildEntityIndex().
 * @param excludeSlug If provided, any entity whose slug matches is skipped (prevents self-links).
 */
export function autoLink(content: string, entities: Entity[], excludeSlug?: string): string {
  if (!content) return content;

  const filtered = excludeSlug ? entities.filter((e) => e.slug !== excludeSlug) : entities;

  const usedEntities = new Set<string>();
  let totalLinks = 0;
  const MAX_LINKS = 8;

  const segments = splitProtectedSegments(content);

  const linkedSegments = segments.map((segment) => {
    if (segment.protected || totalLinks >= MAX_LINKS) {
      return segment.text;
    }

    let text = segment.text;

    for (const entity of filtered) {
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
