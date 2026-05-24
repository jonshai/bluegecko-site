// Build-time auto-linking utility for builder pages.
// Accepts the link map from getLinkTargets() — the same map remark-autolink uses.

import type { LinkTarget } from './getLinkTargets';

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
 * Inject internal links into an assembled HTML string.
 *
 * @param content    HTML to process. Headings, lists, code blocks, and existing
 *                   links are never modified.
 * @param linkMap    Phrase → target map from getLinkTargets(). Already sorted
 *                   longest-phrase-first.
 * @param excludeUrl If provided, any entry whose url matches is skipped (prevents self-links).
 */
export function autoLink(
  content: string,
  linkMap: Map<string, LinkTarget>,
  excludeUrl?: string,
): string {
  if (!content) return content;

  const phrases = [...linkMap.keys()]; // longest-first
  const linkedUrls = new Set<string>();
  let totalLinks = 0;
  const MAX_LINKS = 8;

  const segments = splitProtectedSegments(content);

  const linkedSegments = segments.map((segment) => {
    if (segment.protected || totalLinks >= MAX_LINKS) {
      return segment.text;
    }

    let text = segment.text;

    for (const phrase of phrases) {
      if (totalLinks >= MAX_LINKS) break;

      const target = linkMap.get(phrase)!;
      if (target.url === excludeUrl) continue;
      if (linkedUrls.has(target.url)) continue;

      const escaped = escapeRegex(phrase);
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');

      if (regex.test(text)) {
        text = text.replace(regex, (match) => {
          linkedUrls.add(target.url);
          totalLinks++;
          return `<a href="${target.url}">${match}</a>`;
        });
      }
    }

    return text;
  });

  return linkedSegments.join('');
}
