<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { Editor, Extension } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Image from '@tiptap/extension-image';
  import { apiFetch } from '$lib/client-api.svelte';
  import { blocksToDocument, documentToBlocks, readEditorBlocks } from '$lib/article-editor';

  let { initialBody = '[]' }: { initialBody?: string } = $props();
  let host: HTMLDivElement;
  let fileInput: HTMLInputElement;
  let editor: Editor | undefined;
  let body = $state(untrack(() => initialBody));
  let uploading = $state(false);
  let message = $state('');
  let active = $state({ heading: false, quote: false, list: false, lead: false, image: false, alt: '', caption: '' });

  function sync(current: Editor) {
    const seen = new Set<string>();
    const transaction = current.state.tr;
    current.state.doc.forEach((node, position) => {
      let id = node.attrs.blockId;
      if (!id || seen.has(id)) {
        id = `p-${crypto.randomUUID()}`;
        transaction.setNodeMarkup(position, undefined, { ...node.attrs, blockId: id });
      }
      seen.add(id);
    });
    if (transaction.docChanged) {
      current.view.dispatch(transaction.setMeta('addToHistory', false));
      return;
    }
    body = JSON.stringify(documentToBlocks(current.getJSON()));
    const image = current.getAttributes('image');
    active = { heading: current.isActive('heading'), quote: current.isActive('blockquote'), list: current.isActive('bulletList'), lead: current.isActive('paragraph', { lead: true }), image: current.isActive('image'), alt: image.alt || '', caption: image.caption || '' };
  }

  onMount(() => {
    const attributes = Extension.create({
      name: 'articleAttributes',
      addGlobalAttributes() {
        return [
          { types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'image'], attributes: { blockId: { default: null, rendered: false, keepOnSplit: false } } },
          { types: ['paragraph'], attributes: { lead: { default: false, keepOnSplit: false, parseHTML: element => element.classList.contains('article-lead'), renderHTML: attributes => attributes.lead ? { class: 'article-lead' } : {} } } },
          { types: ['bulletList'], attributes: { intro: { default: '', rendered: false } } }
        ];
      }
    });
    editor = new Editor({
      element: host,
      extensions: [StarterKit.configure({ heading: { levels: [2] }, bold: false, italic: false, strike: false, code: false, codeBlock: false, horizontalRule: false, orderedList: false, link: false, underline: false }), attributes,
        Image.extend({ addAttributes() { return { ...this.parent?.(), caption: { default: '', rendered: false } }; } })],
      content: blocksToDocument(readEditorBlocks(initialBody)),
      editorProps: { attributes: { role: 'textbox', 'aria-label': 'Текст материала', 'aria-multiline': 'true', 'aria-required': 'true', 'data-placeholder': 'Начните писать или вставьте текст статьи…' } },
      onUpdate: ({ editor }) => sync(editor),
      onSelectionUpdate: ({ editor }) => sync(editor)
    });
    sync(editor);
    return () => editor?.destroy();
  });

  async function uploadImage(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !editor) return;
    uploading = true;
    message = '';
    try {
      const data = new FormData(); data.set('image', file);
      const response = await apiFetch('/api/admin/uploads', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Не удалось загрузить изображение');
      editor.chain().focus().setImage({ src: result.url, alt: '' }).run();
    } catch (error) { message = error instanceof Error ? error.message : 'Ошибка загрузки'; }
    finally { uploading = false; input.value = ''; }
  }
</script>

<section class="article-editor" aria-labelledby="article-body-label">
  <span id="article-body-label" class="field-title">Текст материала</span>
  <div class="toolbar" role="toolbar" aria-label="Оформление текста">
    <button type="button" class="secondary" onclick={() => editor?.chain().focus().setParagraph().updateAttributes('paragraph', { lead: false }).run()}>Абзац</button>
    <button type="button" class="secondary" aria-pressed={active.lead} onclick={() => editor?.chain().focus().setParagraph().updateAttributes('paragraph', { lead: !active.lead }).run()}>Лид</button>
    <button type="button" class="secondary" aria-pressed={active.heading} onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>Заголовок</button>
    <button type="button" class="secondary" aria-pressed={active.quote} onclick={() => editor?.chain().focus().toggleBlockquote().run()}>Цитата</button>
    <button type="button" class="secondary" aria-pressed={active.list} onclick={() => editor?.chain().focus().toggleBulletList().run()}>Список</button>
    <button type="button" class="secondary" disabled={uploading} onclick={() => fileInput.click()}>{uploading ? 'Загрузка…' : 'Изображение'}</button>
    <button type="button" class="secondary" aria-label="Отменить изменение" onclick={() => editor?.chain().focus().undo().run()}>↶</button>
    <button type="button" class="secondary" aria-label="Повторить изменение" onclick={() => editor?.chain().focus().redo().run()}>↷</button>
  </div>
  <input class="file-input" bind:this={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onchange={uploadImage} aria-label="Выбрать изображение" />
  {#if active.image}
    <div class="image-fields">
      <label><span>Описание изображения</span><input value={active.alt} oninput={event => editor?.commands.updateAttributes('image', { alt: event.currentTarget.value })} /></label>
      <label><span>Подпись</span><input value={active.caption} oninput={event => editor?.commands.updateAttributes('image', { caption: event.currentTarget.value })} /></label>
    </div>
  {/if}
  <div class="writing-area" bind:this={host}></div>
  <input type="hidden" name="bodyJson" value={body} />
  <small>Пишите или вставляйте текст. Enter создаёт новый абзац. Для оформления используйте кнопки выше.</small>
  {#if message}<p class="error" role="alert">{message}</p>{/if}
</section>

<style>
  .article-editor { display: grid; gap: .6rem; }
  .field-title { font-weight: 600; font-size: .9rem; }
  .toolbar { display: flex; flex-wrap: wrap; gap: .4rem; padding: .7rem; background: var(--cream); border: 1px solid var(--line); border-bottom: 0; margin-bottom: -.6rem; }
  .toolbar button { padding: .45rem .7rem; font-size: .8rem; }
  .toolbar button[aria-pressed="true"] { color: white; background: var(--forest); border-color: var(--forest); }
  .writing-area { border: 1px solid var(--line); background: white; }
  .writing-area:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  .writing-area :global(.tiptap) { min-height: 32rem; padding: 1.5rem; font: 1.15rem/1.8 Georgia, serif; outline: none; overflow-wrap: anywhere; }
  .writing-area :global(.tiptap > :first-child) { margin-top: 0; }
  .writing-area :global(.tiptap p) { margin: 0 0 1rem; }
  .writing-area :global(.tiptap h2) { font-size: 2rem; margin: 2rem 0 1rem; }
  .writing-area :global(.tiptap blockquote) { border-left: 3px solid var(--accent); margin: 1.5rem 0; padding-left: 1.3rem; font-style: italic; }
  .writing-area :global(.article-lead) { font-size: 1.4rem; }
  .writing-area :global(.tiptap img) { max-width: 100%; height: auto; }
  .writing-area :global(.ProseMirror-selectednode) { outline: 2px solid var(--accent); }
  .writing-area :global(.tiptap:has(> p:only-child > br.ProseMirror-trailingBreak)::before) { content: attr(data-placeholder); color: var(--muted); pointer-events: none; float: left; height: 0; }
  .file-input { display: none; }
  .image-fields { display: grid; gap: .5rem; padding: .7rem; border: 1px solid var(--line); background: white; }
  small { color: var(--muted); }
</style>
