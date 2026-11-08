import type { JSONContent } from '@tiptap/core';
import type { ArticleBlock } from './types';

function inline(text: string): JSONContent[] {
  return text.split('\n').flatMap((line, index) => [
    ...(index ? [{ type: 'hardBreak' }] : []),
    ...(line ? [{ type: 'text', text: line }] : [])
  ]);
}
function text(node: JSONContent): string {
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content || []).map(text).join(node.type === 'blockquote' ? '\n\n' : ['bulletList', 'listItem'].includes(node.type || '') ? '\n' : '');
}
export function blocksToDocument(blocks: ArticleBlock[]): JSONContent {
  const content = blocks.map((block): JSONContent => {
    const attrs = { blockId: block.id };
    if (block.type === 'image') return { type: 'image', attrs: { ...attrs, src: block.src, alt: block.alt || '', caption: block.text } };
    if (block.type === 'list') return { type: 'bulletList', attrs: { ...attrs, intro: block.text }, content: (block.items || []).map(item => ({ type: 'listItem', content: [{ type: 'paragraph', content: inline(item) }] })) };
    if (block.type === 'quote') return { type: 'blockquote', attrs, content: [{ type: 'paragraph', content: inline(block.text) }] };
    if (block.type === 'heading') return { type: 'heading', attrs: { ...attrs, level: 2 }, content: inline(block.text) };
    return { type: 'paragraph', attrs: { ...attrs, lead: block.type === 'lead' }, content: inline(block.text) };
  });
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}
export function documentToBlocks(doc: JSONContent): ArticleBlock[] {
  return (doc.content || []).flatMap((node): ArticleBlock[] => {
    const id = String(node.attrs?.blockId || '');
    if (node.type === 'image') return [{ id, type: 'image', text: node.attrs?.caption || '', src: node.attrs?.src || '', alt: node.attrs?.alt || '' }];
    if (node.type === 'bulletList') return [{ id, type: 'list', text: node.attrs?.intro || '', items: (node.content || []).map(item => (item.content || []).map(text).join('\n')) }];
    const value = text(node);
    if (!value.trim()) return [];
    return [{ id, type: node.type === 'heading' ? 'heading' : node.type === 'blockquote' ? 'quote' : node.attrs?.lead ? 'lead' : 'paragraph', text: value }];
  });
}
export function readEditorBlocks(value: string): ArticleBlock[] {
  try { const blocks = JSON.parse(value); return Array.isArray(blocks) ? blocks : []; }
  catch { return []; }
}
