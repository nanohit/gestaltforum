import { describe, expect, it } from 'vitest';
import { blocksToDocument, documentToBlocks } from './article-editor';
import type { ArticleBlock } from './types';

describe('article visual editor storage', () => {
  it('preserves existing block IDs, text, lists and image captions when opening and saving an article', () => {
    const article: ArticleBlock[] = [
      { id: 'lead-1', type: 'lead', text: 'Лид с переносом\nстроки.' },
      { id: 'p-1', type: 'paragraph', text: 'Обычный текст <без HTML>.' },
      { id: 'h-1', type: 'heading', text: 'Подзаголовок' },
      { id: 'q-1', type: 'quote', text: 'Цитата\nс продолжением.' },
      { id: 'list-1', type: 'list', text: 'Вступление к списку', items: ['Один', 'Два\nс продолжением'] },
      { id: 'img-1', type: 'image', src: 'https://example.com/photo.webp', alt: 'Описание', text: 'Подпись' }
    ];
    expect(documentToBlocks(blocksToDocument(article))).toEqual(article);
  });

  it('keeps the paragraph identity when its text is edited so reader annotations can re-anchor', () => {
    const doc = blocksToDocument([{ id: 'existing-p', type: 'paragraph', text: 'До правки' }]);
    doc.content![0].content![0].text = 'После правки';
    expect(documentToBlocks(doc)).toEqual([{ id: 'existing-p', type: 'paragraph', text: 'После правки' }]);
  });

  it('does not submit a blank editor as a nonempty article', () => {
    expect(documentToBlocks(blocksToDocument([]))).toEqual([]);
  });
});
