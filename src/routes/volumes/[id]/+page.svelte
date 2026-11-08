<script lang="ts">
  import { sitePath } from '$lib/site-path';
  let { data }: { data: any } = $props();
</script>

<svelte:head><title>Выпуск {data.volume.number}: {data.volume.title} — Gestalt.forum</title></svelte:head>

<header class="volume-header">
  <p class="eyebrow">Выпуск</p>
  <p class="giant-number">{String(data.volume.number).padStart(2, '0')}</p>
  <h1>{data.volume.title}</h1>
</header>

<section class="page-shell volume-articles">
  {#each data.articles as article, index}
    <article>
      <span>{String(index + 1).padStart(2, '0')}</span>
      <div>
        <div class="meta-row">
          {#if article.access === 'subscribers'}<span class="tag">По подписке</span>{/if}
          {#if article.authors}<span>{article.authors}</span>{/if}
        </div>
        <a href={sitePath(`/materials/${article.slug}`)}><h2>{article.title}</h2></a>
        <p>{article.abstract}</p>
      </div>
    </article>
  {/each}
</section>

<style>
  .volume-header {
    min-height: 65vh;
    padding: clamp(4rem, 8vw, 8rem) max(1.5rem, calc((100vw - 1180px) / 2));
    display: grid;
    align-content: center;
    background: var(--forest);
    color: #f8f1e7;
    overflow: hidden;
  }
  .volume-header .eyebrow { color: #eda58e; }
  .giant-number {
    margin: -.15em 0 -.3em;
    font-family: Georgia, serif;
    font-size: clamp(10rem, 34vw, 30rem);
    line-height: 1;
    opacity: .13;
  }
  .volume-header h1 { max-width: 13ch; }
  .volume-articles article {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr);
    gap: 2rem;
    padding: 2.5rem 0;
    border-bottom: 1px solid var(--line);
  }
  .volume-articles article > span { color: var(--accent); font-family: Georgia, serif; }
  .volume-articles h2 { margin: .7rem 0; font-size: clamp(2rem, 5vw, 4rem); }
  .volume-articles a { text-decoration: none; }
  .volume-articles a:hover h2 { color: var(--accent); }
  .volume-articles p { max-width: 760px; color: var(--muted); }
</style>
