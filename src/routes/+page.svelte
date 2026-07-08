<script lang="ts">
  let { data }: { data: any } = $props();
  const hero = $derived(data.blocks.find((block: any) => block.type === 'hero')?.payload ?? {});
  const note = $derived(data.blocks.find((block: any) => block.type === 'note')?.payload ?? {});

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(value)
        )
      : '';
</script>

<svelte:head>
  <title>Gestalt.forum — практика внимания к человеку</title>
</svelte:head>

<section class="hero">
  <div class="hero-copy">
    <p class="eyebrow">{hero.eyebrow ?? 'Независимый журнал'}</p>
    <h1>{hero.title ?? 'Практика внимания к человеку'}</h1>
    <p class="lede">{hero.text ?? ''}</p>
    <a class="button" href={String(hero.href ?? '/materials')}>{hero.cta ?? 'Читать материалы'}</a>
  </div>
  <div class="hero-orbit" aria-hidden="true">
    <div class="orbit orbit-one"></div>
    <div class="orbit orbit-two"></div>
    <span>G</span>
  </div>
</section>

{#if note.title}
  <aside class="home-note">
    <span>Сейчас</span>
    <strong>{note.title}</strong>
    <p>{note.text}</p>
  </aside>
{/if}

<section class="page-shell latest">
  <div class="section-heading">
    <div>
      <p class="eyebrow">Свежие тексты</p>
      <h2>Материалы</h2>
    </div>
    <a href="/materials">Смотреть все →</a>
  </div>

  <div class="card-grid">
    {#each data.articles as article, index}
      <article class:featured={index === 0} class="article-card card">
        <div class="meta-row">
          {#if article.volume_number}<span>Выпуск {article.volume_number}</span>{/if}
          {#if article.published_at}<span>{formatDate(article.published_at)}</span>{/if}
          {#if article.access === 'subscribers'}<span class="tag">По подписке</span>{/if}
        </div>
        <a class="stretched" href={`/materials/${article.slug}`}>
          <h3>{article.title}</h3>
        </a>
        {#if article.subtitle}<p class="subtitle">{article.subtitle}</p>{/if}
        <p class="abstract">{article.abstract}</p>
        {#if article.authors}<p class="author">{article.authors}</p>{/if}
      </article>
    {/each}
  </div>
</section>

{#if data.latestVolume}
  <section class="volume-band">
    <div>
      <p class="eyebrow">Последний выпуск</p>
      <p class="volume-number">№ {data.latestVolume.number}</p>
    </div>
    <div>
      <h2>{data.latestVolume.title}</h2>
      <p>{data.latestVolume.article_count} материалов · {formatDate(data.latestVolume.published_at)}</p>
    </div>
    <a class="button secondary" href={`/volumes/${data.latestVolume.id}`}>Открыть выпуск</a>
  </section>
{/if}

<section class="manifesto">
  <p>Не новости. Не советы.</p>
  <h2>Место, где мысль может не торопиться.</h2>
  <a href="/submission">Предложить материал →</a>
</section>

<style>
  .hero {
    min-height: 72vh;
    max-width: 1480px;
    margin: 0 auto;
    padding: clamp(4rem, 8vw, 8rem) clamp(1.5rem, 7vw, 7rem);
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(260px, .8fr);
    align-items: center;
    gap: 3rem;
    overflow: hidden;
    position: relative;
  }

  .hero-copy {
    position: relative;
    z-index: 2;
  }

  .hero h1 {
    max-width: 12ch;
  }

  .hero .lede {
    max-width: 620px;
    margin: 2rem 0;
  }

  .hero-orbit {
    position: relative;
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    min-width: 0;
  }

  .hero-orbit span {
    font-family: Georgia, serif;
    font-size: clamp(7rem, 17vw, 16rem);
    color: var(--accent);
  }

  .orbit {
    position: absolute;
    inset: 7%;
    border: 1px solid var(--line);
    border-radius: 51% 49% 45% 55% / 41% 55% 45% 59%;
    transform: rotate(12deg);
  }

  .orbit-two {
    inset: 18% 2%;
    border-color: var(--accent);
    opacity: .45;
    transform: rotate(-27deg);
  }

  .home-note {
    max-width: 1480px;
    margin: 0 auto;
    padding: 1.2rem 2rem;
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: baseline;
    gap: 1.5rem;
    border-block: 1px solid var(--line);
    color: var(--muted);
  }

  .home-note span {
    color: var(--accent);
    text-transform: uppercase;
    font-size: .7rem;
    letter-spacing: .16em;
  }

  .home-note strong {
    color: var(--ink);
  }

  .home-note p {
    margin: 0;
  }

  .section-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .section-heading h2 {
    margin: 0;
  }

  .article-card h3 {
    font-size: 1.75rem;
    line-height: 1.05;
  }

  .article-card.featured {
    grid-column: span 2;
    background: var(--cream);
  }

  .article-card.featured h3 {
    font-size: clamp(2.4rem, 5vw, 4.3rem);
    max-width: 16ch;
  }

  .subtitle {
    font-family: Georgia, serif;
    font-size: 1.05rem;
  }

  .abstract, .author {
    color: var(--muted);
  }

  .author {
    margin-top: 2rem;
    font-size: .82rem;
  }

  .volume-band {
    padding: clamp(2rem, 5vw, 5rem) max(1.5rem, calc((100vw - 1180px) / 2));
    background: var(--forest);
    color: #f5efe5;
    display: grid;
    grid-template-columns: .65fr 1fr auto;
    align-items: center;
    gap: 3rem;
  }

  .volume-band .eyebrow {
    color: #e9a58f;
  }

  .volume-number {
    font-family: Georgia, serif;
    font-size: clamp(4rem, 10vw, 8rem);
    margin: 0;
  }

  .volume-band h2 {
    margin: 0;
  }

  .volume-band .secondary {
    color: #f5efe5;
    border-color: #f5efe5;
  }

  .manifesto {
    text-align: center;
    padding: clamp(5rem, 12vw, 10rem) 1.5rem;
  }

  .manifesto p {
    color: var(--accent);
    text-transform: uppercase;
    font-size: .74rem;
    letter-spacing: .18em;
  }

  .manifesto h2 {
    max-width: 16ch;
    margin: 2rem auto;
    font-size: clamp(2.5rem, 6vw, 5.5rem);
  }

  @media (max-width: 760px) {
    .hero {
      grid-template-columns: 1fr;
      min-height: auto;
      padding: clamp(4rem, 13vw, 5.8rem) 1.5rem clamp(6rem, 22vw, 8rem);
      gap: 1.8rem;
    }

    .hero h1 {
      max-width: 10.5ch;
    }

    .hero .lede {
      margin: 1.35rem 0 1.55rem;
      max-width: 28rem;
    }

    .hero-orbit {
      position: absolute;
      right: clamp(-3.2rem, -8vw, -1.2rem);
      bottom: clamp(1.2rem, 7vw, 3rem);
      width: clamp(9rem, 36vw, 13rem);
      opacity: .78;
      z-index: 1;
      pointer-events: none;
    }

    .hero-orbit span {
      font-size: clamp(5.2rem, 25vw, 8rem);
    }

    .orbit {
      inset: 9%;
    }

    .orbit-two {
      inset: 17% 1%;
    }

    .section-heading {
      align-items: start;
      gap: 1rem;
      margin-bottom: 1.35rem;
    }

    .section-heading a {
      white-space: nowrap;
    }

    .home-note {
      grid-template-columns: 1fr;
      gap: .25rem;
      padding-inline: 1.5rem;
    }

    .article-card.featured {
      grid-column: auto;
    }

    .volume-band {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }
</style>
