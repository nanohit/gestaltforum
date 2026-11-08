<script lang="ts">
  import ArticleEditor from '$lib/components/ArticleEditor.svelte';
  import { sitePath } from '$lib/site-path';
  let { data, form }: { data: any; form: any } = $props();

</script>

<svelte:head><title>{data.isNew ? 'Новый материал' : data.article.title} — Редакция</title></svelte:head>

<div class="editor-page">
  <header>
    <div>
      <a href={sitePath("/admin#articles")}>← К материалам</a>
      <p class="eyebrow">{data.isNew ? 'Новый материал' : `Материал #${data.article.id}`}</p>
      <h1>{data.isNew ? 'Собрать текст' : data.article.title}</h1>
    </div>
    {#if !data.isNew}<a class="button secondary" href={sitePath(`/materials/${data.article.slug}`)}>Предпросмотр ↗</a>{/if}
  </header>

  {#if form?.error}<p class="error">{form.error}</p>{/if}
  {#if form?.success}<p class="success">Материал сохранён.</p>{/if}

  <form method="POST" action="?/save" class="editor-form">
    <section class="main-fields">
      <label><span>Заголовок</span><input class="title-input" name="title" value={data.article?.title ?? ''} maxlength="300" required /></label>
      <label><span>Подзаголовок</span><textarea class="small-textarea" name="subtitle" maxlength="500">{data.article?.subtitle ?? ''}</textarea></label>
      <label><span>Аннотация</span><textarea name="abstract" maxlength="3000" minlength="10" required>{data.article?.abstract ?? ''}</textarea></label>
      {#key data.article?.id ?? 'new'}
        <ArticleEditor initialBody={data.article?.body_json ?? '[]'} />
      {/key}
    </section>

    <aside>
      <div class="side-card">
        <h2>Публикация</h2>
        <label><span>Статус</span><select name="status" value={data.article?.status ?? 'draft'}><option value="draft">Черновик</option><option value="review">На ревью</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label>
        <label><span>Доступ</span><select name="access" value={data.article?.access ?? 'public'}><option value="public">Открытый</option><option value="subscribers">По подписке</option></select></label>
        <label><span>Slug</span><input name="slug" value={data.article?.slug ?? ''} pattern="[a-z0-9-]+" required /></label>
        <label><span>Выпуск</span><select name="volumeId" value={data.article?.volume_id ?? 0}><option value="0">Без выпуска</option>{#each data.volumes as volume}<option value={volume.id}>№ {volume.number} · {volume.title}</option>{/each}</select></label>
        <label class="checkbox"><input type="checkbox" name="commentsEnabled" checked={data.article?.comments_enabled ?? true} /><span>Комментарии включены</span></label>
        <button type="submit">Сохранить</button>
      </div>

      <div class="side-card">
        <h2>Авторы</h2>
        <div class="author-list">
          {#each data.authors as author}
            <label class="checkbox">
              <input type="checkbox" name="authorIds" value={author.id} checked={data.selectedAuthors.includes(author.id)} />
              <span>{author.first_name} {author.last_name}<small>{author.role}</small></span>
            </label>
          {/each}
        </div>
      </div>
    </aside>
  </form>

  {#if !data.isNew}
    <form method="POST" action="?/delete" onsubmit={(event) => !confirm('Удалить материал безвозвратно?') && event.preventDefault()}>
      <button class="danger" type="submit">Удалить материал</button>
    </form>
  {/if}
</div>

<style>
  .editor-page { width: min(1260px, calc(100% - 3rem)); margin: 0 auto; padding: 3rem 0 7rem; }
  .editor-page > header { display: flex; justify-content: space-between; gap: 2rem; align-items: end; margin-bottom: 3rem; }
  .editor-page > header a:first-child { display: inline-block; margin-bottom: 2rem; }
  .editor-page h1 { font-size: clamp(2.8rem, 6vw, 5rem); max-width: 14ch; }
  .editor-form { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 2rem; align-items: start; margin-bottom: 4rem; }
  .main-fields { display: grid; gap: 1.4rem; }
  .title-input { font-family: Georgia, serif; font-size: 2rem; }
  .small-textarea { min-height: 5rem; }
  aside { display: grid; gap: 1rem; position: sticky; top: 1rem; }
  .side-card { display: grid; gap: .9rem; padding: 1.2rem; border: 1px solid var(--line); background: white; }
  .side-card h2 { margin: 0; font-size: 1.5rem; }
  .checkbox { display: flex; grid-template-columns: auto 1fr; align-items: start; gap: .6rem; color: var(--ink); }
  .checkbox input { width: auto; margin-top: .2rem; }
  .checkbox small { display: block; color: var(--muted); }
  .author-list { display: grid; gap: .55rem; max-height: 340px; overflow: auto; }
  @media (max-width: 900px) {
    .editor-form { grid-template-columns: 1fr; }
    aside { position: static; }
  }
</style>
