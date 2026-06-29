<script lang="ts">
  import ArticleReader from '$lib/components/ArticleReader.svelte';

  let { data }: { data: any } = $props();
  // svelte-ignore state_referenced_locally
  let favoriteKinds = $state<string[]>([...data.favorites]);
  let feedback = $state('');
  let commentBody = $state('');

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(value)
        )
      : '';

  async function toggleFavorite(kind: 'fav' | 'read_later') {
    const active = favoriteKinds.includes(kind);
    const response = await fetch('/api/favorites', {
      method: active ? 'DELETE' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articleId: data.article.id, kind })
    });
    if (response.ok) {
      favoriteKinds = active
        ? favoriteKinds.filter((item) => item !== kind)
        : [...favoriteKinds, kind];
    }
  }

  async function submitComment(event: SubmitEvent) {
    event.preventDefault();
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target: 'article', targetId: data.article.id, body: commentBody })
    });
    const result = await response.json();
    feedback = result.message || (response.ok ? 'Комментарий отправлен на модерацию' : 'Ошибка');
    if (response.ok) commentBody = '';
  }
</script>

<svelte:head>
  <title>{data.article.title} — Gestalt.forum</title>
  <meta name="description" content={data.article.abstract} />
</svelte:head>

<article class="article-page">
  <header class="article-header">
    <div class="meta-row">
      {#if data.article.volume_number}
        <a href={`/volumes/${data.article.volume_id}`}>Выпуск {data.article.volume_number}</a>
      {/if}
      <span>{formatDate(data.article.published_at)}</span>
      {#if data.article.access === 'subscribers'}<span class="tag">По подписке</span>{/if}
      {#if data.article.status !== 'published'}<span class="tag">Предпросмотр: {data.article.status}</span>{/if}
    </div>
    <h1>{data.article.title}</h1>
    {#if data.article.subtitle}<p class="subtitle">{data.article.subtitle}</p>{/if}
    {#if data.article.authors}<p class="authors">{data.article.authors}</p>{/if}
    <p class="abstract">{data.article.abstract}</p>

    {#if data.user}
      <div class="reader-actions">
        <button
          class:active={favoriteKinds.includes('fav')}
          class="secondary"
          type="button"
          onclick={() => toggleFavorite('fav')}
        >
          {favoriteKinds.includes('fav') ? '★ В избранном' : '☆ В избранное'}
        </button>
        <button
          class:active={favoriteKinds.includes('read_later')}
          class="secondary"
          type="button"
          onclick={() => toggleFavorite('read_later')}
        >
          {favoriteKinds.includes('read_later') ? '✓ Отложено' : 'На потом'}
        </button>
      </div>
    {/if}
  </header>

  {#if data.locked}
    <section class="locked">
      <p class="eyebrow">Материал по подписке</p>
      <h2>Продолжение доступно подписчикам</h2>
      <p>Подписка открывает полный архив, выделения, заметки и участие в разговоре.</p>
      {#if data.user}
        <a class="button" href="/account#subscription">Выбрать подписку</a>
      {:else}
        <a class="button" href={`/auth/login?next=/materials/${data.article.slug}`}>Войти и продолжить</a>
      {/if}
    </section>
  {:else}
    <div class="article-body-shell">
      <ArticleReader
        articleId={data.article.id}
        blocks={data.article.blocks}
        initialAnnotations={data.annotations}
        canAnnotate={Boolean(data.user)}
      />
    </div>
  {/if}
</article>

{#if !data.locked && data.article.comments_enabled}
  <section class="comments-section narrow">
    <p class="eyebrow">Разговор после текста</p>
    <h2>Комментарии</h2>
    {#if data.comments.length}
      <div class="comments">
        {#each data.comments as comment}
          <article>
            <div class="meta-row">
              <strong>{comment.first_name} {comment.last_name}</strong>
              <span>{formatDate(comment.created_at)}</span>
            </div>
            <p>{comment.body}</p>
          </article>
        {/each}
      </div>
    {:else}
      <p class="muted">Здесь пока тихо.</p>
    {/if}

    {#if data.user}
      <form class="comment-form" onsubmit={submitComment}>
        <label>
          <span>Ваш комментарий</span>
          <textarea bind:value={commentBody} minlength="2" maxlength="3000" required></textarea>
        </label>
        <button type="submit">Отправить</button>
        {#if feedback}<p class="muted">{feedback}</p>{/if}
      </form>
    {:else}
      <p><a href={`/auth/login?next=/materials/${data.article.slug}`}>Войдите</a>, чтобы оставить комментарий.</p>
    {/if}
  </section>
{/if}

<style>
  .article-header {
    width: min(980px, calc(100% - 3rem));
    margin: 0 auto;
    padding: clamp(5rem, 10vw, 9rem) 0 clamp(3rem, 7vw, 6rem);
    text-align: center;
  }

  .article-header .meta-row {
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .article-header h1 {
    font-size: clamp(3rem, 8vw, 7.3rem);
  }

  .subtitle {
    max-width: 700px;
    margin: 2rem auto 1rem;
    font-family: Georgia, serif;
    font-size: clamp(1.3rem, 2.5vw, 1.8rem);
    line-height: 1.4;
  }

  .authors {
    color: var(--accent);
  }

  .abstract {
    max-width: 700px;
    margin: 2.5rem auto 0;
    padding-top: 2rem;
    border-top: 1px solid var(--line);
    font-size: 1.08rem;
    color: var(--muted);
  }

  .reader-actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: .5rem;
    margin-top: 2rem;
  }

  .reader-actions .active {
    background: var(--cream);
  }

  .article-body-shell {
    width: min(1120px, calc(100% - 3rem));
    margin: 0 auto;
    padding-bottom: 7rem;
  }

  .locked {
    width: min(700px, calc(100% - 3rem));
    margin: 0 auto 8rem;
    padding: clamp(2rem, 6vw, 5rem);
    background: var(--cream);
    text-align: center;
  }

  .locked .eyebrow {
    justify-content: center;
  }

  .comments-section {
    padding: 5rem 0 7rem;
    border-top: 1px solid var(--line);
  }

  .comments article {
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--line);
  }

  .comment-form {
    display: grid;
    gap: 1rem;
    margin-top: 2.5rem;
  }

  .comment-form button {
    justify-self: start;
  }
</style>
