<script lang="ts">
  let { data }: { data: any } = $props();
  const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(value)) : '';
</script>

<svelte:head><title>Выпуски — Gestalt.forum</title></svelte:head>

<section class="page-shell">
  <p class="eyebrow">Архив журнала</p>
  <h1>Выпуски</h1>
  <p class="lede intro">Каждый выпуск — разговор вокруг темы, собранный из разных голосов и оптик.</p>

  <div class="volume-list">
    {#each data.volumes as volume}
      <a href={`/volumes/${volume.id}`}>
        <span class="number">№ {volume.number}</span>
        <span>
          <strong>{volume.title}</strong>
          <small>{formatDate(volume.published_at)} · {volume.article_count} материалов</small>
        </span>
        <span class="arrow">↗</span>
      </a>
    {/each}
  </div>
</section>

<style>
  .intro { max-width: 700px; margin: 2rem 0 5rem; }
  .volume-list { border-top: 1px solid var(--line); }
  .volume-list a {
    display: grid;
    grid-template-columns: minmax(120px, .35fr) 1fr auto;
    align-items: center;
    gap: 2rem;
    padding: 2.5rem 0;
    border-bottom: 1px solid var(--line);
    text-decoration: none;
  }
  .volume-list a:hover strong { color: var(--accent); }
  .number { font-family: Georgia, serif; font-size: clamp(2.5rem, 6vw, 5rem); color: var(--accent); }
  strong { display: block; font-family: Georgia, serif; font-weight: 500; font-size: clamp(1.6rem, 4vw, 3rem); }
  small { color: var(--muted); }
  .arrow { font-size: 2rem; }
  @media (max-width: 600px) {
    .volume-list a { grid-template-columns: 1fr auto; }
    .number { grid-column: 1 / -1; }
  }
</style>
