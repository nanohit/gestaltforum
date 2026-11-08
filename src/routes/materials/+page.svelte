<script lang="ts">
  import { sitePath } from '$lib/site-path';
  let { data }: { data: any } = $props();
  const query = $derived(data.query);
  const articles = $derived(data.articles);
  const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '';
</script>

<svelte:head>
  <title>{query ? `Поиск: ${query}` : 'Материалы'} — Gestalt.forum</title>
</svelte:head>

<section class="page-shell">
  <header class="materials-header">
    <div>
      <p class="eyebrow">Архив журнала</p>
      <h1>Материалы</h1>
    </div>
    <form class="search" method="GET">
      <label>
        <span>Поиск по текстам</span>
        <div class="search-row">
          <input name="q" value={query} placeholder="Тема, автор, понятие…" maxlength="120" />
          <button type="submit">Найти</button>
        </div>
      </label>
    </form>
  </header>

  {#if query}
    <p class="result-note">Результаты по запросу «{query}»: {articles.length}</p>
  {/if}

  {#if articles.length}
    <div class="materials-list">
      {#each articles as article, index}
        <article>
          <div class="index">{String(index + 1).padStart(2, '0')}</div>
          <div class="article-copy">
            <div class="meta-row">
              {#if article.volume_number}<span>Выпуск {article.volume_number}</span>{/if}
              <span>{formatDate(article.published_at)}</span>
              {#if article.access === 'subscribers'}<span class="tag">По подписке</span>{/if}
            </div>
            <a href={sitePath(`/materials/${article.slug}`)}><h2>{article.title}</h2></a>
            {#if article.subtitle}<p class="subtitle">{article.subtitle}</p>{/if}
            <p class="abstract">{article.abstract}</p>
            {#if article.authors}<p class="authors">{article.authors}</p>{/if}
          </div>
          <a class="arrow" aria-label={`Открыть ${article.title}`} href={sitePath(`/materials/${article.slug}`)}>↗</a>
        </article>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <h2>Ничего не нашлось</h2>
      <p>Попробуйте более короткий запрос или загляните в полный архив.</p>
      <a href={sitePath("/materials")}>Сбросить поиск</a>
    </div>
  {/if}
</section>

<style>
  .materials-header {
    display: grid;
    grid-template-columns: 1fr minmax(320px, .8fr);
    align-items: end;
    gap: 3rem;
    margin-bottom: 4rem;
  }

  .search-row {
    display: flex;
    gap: .5rem;
  }

  .search-row input {
    border-radius: 999px;
  }

  .result-note {
    color: var(--muted);
    border-bottom: 1px solid var(--line);
    padding-bottom: 1rem;
  }

  .materials-list article {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr) auto;
    gap: 1.5rem;
    padding: 2.4rem 0;
    border-bottom: 1px solid var(--line);
  }

  .index {
    color: var(--accent);
    font-family: Georgia, serif;
    font-size: 1.25rem;
  }

  .article-copy {
    max-width: 800px;
  }

  .article-copy a {
    text-decoration: none;
  }

  .article-copy h2 {
    margin: .7rem 0;
    font-size: clamp(1.8rem, 4vw, 3.2rem);
  }

  .article-copy a:hover h2 {
    color: var(--accent);
  }

  .subtitle {
    font-family: Georgia, serif;
    font-size: 1.15rem;
  }

  .abstract, .authors {
    color: var(--muted);
  }

  .authors {
    font-size: .85rem;
  }

  .arrow {
    font-size: 1.8rem;
    text-decoration: none;
  }

  @media (max-width: 720px) {
    .materials-header {
      grid-template-columns: 1fr;
      margin-bottom: 2rem;
    }

    .materials-list article {
      grid-template-columns: 2rem minmax(0, 1fr);
    }

    .arrow {
      display: none;
    }
  }
</style>
