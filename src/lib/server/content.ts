import type { ArticleBlock, PageBlock } from '$lib/types';

export function parseArticleBody(value: string): ArticleBlock[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          (typeof item.text === 'string' ||
            (item.type === 'image' && typeof item.src === 'string'))
      )
      .map((item, index) => ({
        id: String(item.id || `p-${index + 1}`),
        type: ['paragraph', 'lead', 'heading', 'quote', 'list', 'image'].includes(item.type)
          ? item.type
          : 'paragraph',
        text: String(item.text || ''),
        items: Array.isArray(item.items) ? item.items.map(String) : undefined,
        src: typeof item.src === 'string' ? item.src : undefined,
        alt: typeof item.alt === 'string' ? item.alt : undefined
      })) as ArticleBlock[];
  } catch {
    return [];
  }
}

export function articleBodyText(value: string): string {
  return parseArticleBody(value)
    .map((block) =>
      block.type === 'image'
        ? block.text
        : block.items?.length
          ? `${block.text}\n${block.items.join('\n')}`
          : block.text
    )
    .join('\n\n');
}

export function parsePageBlock(row: {
  id: number;
  type: string;
  payload_json: string;
  position: number;
}): PageBlock {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload_json) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  return { id: row.id, type: row.type, payload, position: row.position };
}

export function excerpt(text: string, length = 180): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > length ? `${normalized.slice(0, length).trimEnd()}…` : normalized;
}
