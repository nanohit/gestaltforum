<script lang="ts">
  import { apiFetch } from '$lib/client-api.svelte';
  import { onMount, tick } from 'svelte';
  import type { Annotation, ArticleBlock } from '$lib/types';

  let {
    articleId,
    blocks,
    initialAnnotations = [],
    canAnnotate = false
  }: {
    articleId: number;
    blocks: ArticleBlock[];
    initialAnnotations: Annotation[];
    canAnnotate: boolean;
  } = $props();

  let reader: HTMLElement;
  let annotations = $state<Annotation[]>([]);
  let selection = $state<{
    paragraphId: string;
    quote: string;
    prefix: string;
    suffix: string;
    startOff: number;
    endOff: number;
  } | null>(null);
  let message = $state('');

  function textOffset(root: Node, target: Node, offset: number): number {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(target, offset);
    return range.toString().length;
  }

  function captureSelection() {
    if (!canAnnotate) return;
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.isCollapsed || !browserSelection.rangeCount) {
      selection = null;
      return;
    }
    const range = browserSelection.getRangeAt(0);
    const startElement =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement;
    const endElement =
      range.endContainer instanceof Element ? range.endContainer : range.endContainer.parentElement;
    const startParagraph = startElement?.closest<HTMLElement>('[data-pid]');
    const endParagraph = endElement?.closest<HTMLElement>('[data-pid]');
    if (!startParagraph || startParagraph !== endParagraph || !reader.contains(startParagraph)) {
      selection = null;
      return;
    }
    const quote = range.toString().trim();
    if (quote.length < 2 || quote.length > 1200) {
      selection = null;
      return;
    }
    const startOff = textOffset(startParagraph, range.startContainer, range.startOffset);
    const rawEnd = textOffset(startParagraph, range.endContainer, range.endOffset);
    const fullText = startParagraph.textContent || '';
    const leadingTrim = range.toString().length - range.toString().trimStart().length;
    const endTrim = range.toString().length - range.toString().trimEnd().length;
    const normalizedStart = startOff + leadingTrim;
    const normalizedEnd = rawEnd - endTrim;
    selection = {
      paragraphId: startParagraph.dataset.pid || '',
      quote,
      prefix: fullText.slice(Math.max(0, normalizedStart - 36), normalizedStart),
      suffix: fullText.slice(normalizedEnd, normalizedEnd + 36),
      startOff: normalizedStart,
      endOff: normalizedEnd
    };
  }

  function removeRenderedAnnotations() {
    if (!reader) return;
    for (const mark of reader.querySelectorAll<HTMLElement>('[data-annotation-rendered]')) {
      const parent = mark.parentNode;
      while (mark.firstChild) parent?.insertBefore(mark.firstChild, mark);
      mark.remove();
      parent?.normalize();
    }
  }

  function locate(annotation: Annotation, text: string): [number, number] | null {
    const candidates: number[] = [];
    let from = 0;
    while (from <= text.length) {
      const found = text.indexOf(annotation.quote, from);
      if (found < 0) break;
      candidates.push(found);
      from = found + 1;
    }

    const exact = candidates.find((position) => {
      const prefix = text.slice(Math.max(0, position - annotation.prefix.length), position);
      const suffix = text.slice(
        position + annotation.quote.length,
        position + annotation.quote.length + annotation.suffix.length
      );
      return prefix.endsWith(annotation.prefix) && suffix.startsWith(annotation.suffix);
    });
    if (exact !== undefined) return [exact, exact + annotation.quote.length];

    if (
      annotation.start_off >= 0 &&
      annotation.end_off <= text.length &&
      text.slice(annotation.start_off, annotation.end_off) === annotation.quote
    ) {
      return [annotation.start_off, annotation.end_off];
    }

    if (candidates.length === 1) return [candidates[0], candidates[0] + annotation.quote.length];
    return null;
  }

  function rangeAtOffsets(root: HTMLElement, start: number, end: number): Range | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let position = 0;
    let startNode: Node | null = null;
    let endNode: Node | null = null;
    let startOffset = 0;
    let endOffset = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length || 0;
      if (!startNode && start >= position && start <= position + length) {
        startNode = node;
        startOffset = start - position;
      }
      if (end >= position && end <= position + length) {
        endNode = node;
        endOffset = end - position;
        break;
      }
      position += length;
    }
    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  }

  function renderAnnotations() {
    if (!reader) return;
    removeRenderedAnnotations();
    const sorted = [...annotations].sort((a, b) => b.start_off - a.start_off);
    for (const annotation of sorted) {
      const paragraph = reader.querySelector<HTMLElement>(
        `[data-pid="${CSS.escape(annotation.paragraph_id)}"]`
      );
      if (!paragraph) continue;
      const position = locate(annotation, paragraph.textContent || '');
      if (!position) continue;
      const range = rangeAtOffsets(paragraph, position[0], position[1]);
      if (!range || range.collapsed) continue;
      const mark = document.createElement('mark');
      mark.dataset.annotationRendered = String(annotation.id);
      mark.dataset.type = annotation.type;
      mark.dataset.color = annotation.color;
      if (annotation.note) mark.title = annotation.note;
      try {
        range.surroundContents(mark);
      } catch {
        // A selection spanning mixed inline nodes is still stored and can be re-anchored later.
      }
    }
  }

  async function saveAnnotation(type: Annotation['type']) {
    if (!selection) return;
    let note = '';
    if (type === 'note') note = window.prompt('Заметка к выделению')?.trim() || '';
    const response = await apiFetch('/api/annotations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        articleId,
        paragraphId: selection.paragraphId,
        type,
        quote: selection.quote,
        prefix: selection.prefix,
        suffix: selection.suffix,
        startOff: selection.startOff,
        endOff: selection.endOff,
        note,
        color: type === 'underline' ? 'red' : 'yellow'
      })
    });
    const result = await response.json();
    if (!response.ok) {
      message = result.message || 'Не удалось сохранить выделение';
      return;
    }
    annotations.push(result.annotation);
    selection = null;
    window.getSelection()?.removeAllRanges();
    await tick();
    renderAnnotations();
    message = 'Выделение сохранено';
  }

  async function deleteAnnotation(id: number) {
    const response = await apiFetch('/api/annotations', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (response.ok) {
      annotations = annotations.filter((annotation) => annotation.id !== id);
      renderAnnotations();
    }
  }

  onMount(() => {
    annotations = [...initialAnnotations];
    renderAnnotations();
    document.addEventListener('selectionchange', captureSelection);
    return () => document.removeEventListener('selectionchange', captureSelection);
  });
</script>

<div class="reader-layout">
  <article class="reader" bind:this={reader}>
    {#each blocks as block}
      {#if block.type === 'heading'}
        <h2 data-pid={block.id}>{block.text}</h2>
      {:else if block.type === 'quote'}
        <blockquote data-pid={block.id}>{block.text}</blockquote>
      {:else if block.type === 'lead'}
        <p class="article-lead" data-pid={block.id}>{block.text}</p>
      {:else if block.type === 'list' && block.items}
        <section data-pid={block.id}>
          {#if block.text}<p>{block.text}</p>{/if}
          <ul>
            {#each block.items as item}<li>{item}</li>{/each}
          </ul>
        </section>
      {:else if block.type === 'image' && block.src}
        <figure data-pid={block.id}>
          <img src={block.src} alt={block.alt || ''} loading="lazy" />
          {#if block.text}<figcaption>{block.text}</figcaption>{/if}
        </figure>
      {:else}
        <p data-pid={block.id}>{block.text}</p>
      {/if}
    {/each}
  </article>

  {#if canAnnotate}
    <aside class="annotations-panel">
      <h3>Мои пометки</h3>
      {#if message}<p class="reader-message">{message}</p>{/if}
      {#if annotations.length}
        <div class="annotation-list">
          {#each annotations as annotation}
            <div class="annotation-item">
              <span class="annotation-kind">
                {annotation.type === 'note' ? 'Заметка' : annotation.type === 'underline' ? 'Подчёркивание' : 'Выделение'}
              </span>
              <q>{annotation.quote}</q>
              {#if annotation.note}<p>{annotation.note}</p>{/if}
              <button class="text-button" type="button" onclick={() => deleteAnnotation(annotation.id)}>
                Удалить
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">Выделите фрагмент текста, чтобы сохранить его.</p>
      {/if}
    </aside>
  {/if}
</div>

{#if selection}
  <div class="selection-toolbar" role="toolbar" aria-label="Действия с выделенным текстом">
    <button type="button" onclick={() => saveAnnotation('highlight')}>Выделить</button>
    <button type="button" onclick={() => saveAnnotation('underline')}>Подчеркнуть</button>
    <button type="button" onclick={() => saveAnnotation('note')}>Заметка</button>
    <button class="secondary" type="button" onclick={() => (selection = null)}>×</button>
  </div>
{/if}

<style>
  .reader-layout {
    display: grid;
    grid-template-columns: minmax(0, 720px) minmax(220px, 300px);
    justify-content: center;
    gap: clamp(2rem, 6vw, 6rem);
    align-items: start;
  }

  .reader {
    min-width: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.12rem, 2vw, 1.32rem);
    line-height: 1.82;
  }

  .reader p {
    margin: 0 0 1.5em;
  }

  .reader h2 {
    margin: 2.2em 0 .8em;
    font-size: clamp(2rem, 5vw, 3.2rem);
    line-height: 1.05;
  }

  .reader .article-lead {
    font-size: 1.3em;
    line-height: 1.55;
    color: #48463f;
  }

  .reader blockquote {
    margin: 2.4em 0;
    padding: .5em 0 .5em 1.5em;
    border-left: 3px solid var(--accent);
    font-size: 1.25em;
    font-style: italic;
    color: #4d4a42;
  }

  .reader figure {
    margin: 2.5em -8%;
  }

  .reader figure img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: .2rem;
  }

  .reader figcaption {
    margin-top: .65rem;
    color: var(--muted);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: .72em;
  }

  :global(.reader mark[data-annotation-rendered]) {
    background: rgba(232, 193, 73, .38);
    color: inherit;
    border-radius: .12em;
  }

  :global(.reader mark[data-type="underline"]) {
    background: transparent;
    text-decoration: underline 2px var(--accent);
    text-underline-offset: .18em;
  }

  :global(.reader mark[data-type="note"]) {
    background: rgba(104, 145, 126, .24);
    border-bottom: 2px solid var(--forest);
  }

  .annotations-panel {
    position: sticky;
    top: 2rem;
    max-height: calc(100vh - 4rem);
    overflow: auto;
    padding-left: 1.2rem;
    border-left: 1px solid var(--line);
  }

  .annotations-panel h3 {
    font-family: inherit;
    font-size: .8rem;
    text-transform: uppercase;
    letter-spacing: .12em;
  }

  .annotation-list {
    display: grid;
    gap: .9rem;
  }

  .annotation-item {
    padding: .85rem;
    border: 1px solid var(--line);
    background: rgba(255,253,248,.55);
    font-size: .82rem;
  }

  .annotation-item q {
    display: block;
    margin: .45rem 0;
    font-family: Georgia, serif;
    font-size: .95rem;
  }

  .annotation-item p {
    margin: .5rem 0;
  }

  .annotation-kind {
    color: var(--accent);
    font-size: .68rem;
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  .text-button {
    background: none;
    color: var(--muted);
    border: 0;
    padding: .3rem 0;
    text-decoration: underline;
    font-size: .75rem;
  }

  .selection-toolbar {
    position: fixed;
    z-index: 100;
    left: 50%;
    bottom: 1.5rem;
    transform: translateX(-50%);
    display: flex;
    gap: .35rem;
    padding: .45rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--white);
    box-shadow: 0 14px 50px rgba(25,20,15,.22);
  }

  .selection-toolbar button {
    padding: .55rem .8rem;
    font-size: .78rem;
  }

  .reader-message {
    font-size: .75rem;
    color: var(--forest);
  }

  @media (max-width: 940px) {
    .reader-layout {
      grid-template-columns: minmax(0, 720px);
    }

    .annotations-panel {
      position: static;
      order: -1;
      max-height: none;
      padding: 1rem;
      border: 1px solid var(--line);
    }
  }

  @media (max-width: 620px) {
    .reader figure {
      margin-inline: 0;
    }

    .selection-toolbar {
      width: calc(100% - 1rem);
      overflow-x: auto;
    }
  }
</style>
