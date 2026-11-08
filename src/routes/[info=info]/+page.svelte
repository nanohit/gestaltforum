<script lang="ts">
  import { sitePath } from '$lib/site-path';
  let { data }: { data: any } = $props();
</script>

<svelte:head><title>{data.page.title} — Gestalt.forum</title></svelte:head>

<section class="page-shell info-page">
  <p class="eyebrow">Gestalt.forum</p>
  <h1>{data.page.title}</h1>
  {#if data.blocks.length}
    <div class="content">
      {#each data.blocks as block}
        {#if block.type === 'heading'}
          <h2>{block.payload.text}</h2>
        {:else if block.type === 'people'}
          <div class="people">
            {#each block.payload.items ?? [] as person}
              <article><h3>{person.name}</h3><p>{person.role}</p><p>{person.bio}</p></article>
            {/each}
          </div>
        {:else}
          <section class="text-block">
            {#if block.payload.title}<h2>{block.payload.title}</h2>{/if}
            {#if block.payload.text}<p>{block.payload.text}</p>{/if}
          </section>
        {/if}
      {/each}
    </div>
  {:else}
    {#if data.page.slug === 'editors'}
      <div class="content">
        <p class="lede">Мы собираем редакцию. Имена и области ответственности появятся здесь после запуска первого выпуска.</p>
        <p>По вопросам сотрудничества напишите через <a href={sitePath("/support")}>форму поддержки</a>.</p>
      </div>
    {:else if data.page.slug === 'submission'}
      <div class="content">
        <p class="lede">Мы принимаем оригинальные эссе, исследования практики, рецензии и переводы.</p>
        <h2>Как предложить текст</h2>
        <p>Опишите идею, предполагаемый объём и коротко расскажите о себе через форму поддержки. Редакция ответит и предложит следующий шаг.</p>
        <a class="button" href={sitePath("/support?subject=Предложение материала")}>Предложить материал</a>
      </div>
    {:else}
      <div class="content"><p class="muted">Редакция пока не добавила содержимое этой страницы.</p></div>
    {/if}
  {/if}
</section>

<style>
  .info-page h1 { max-width: 11ch; }
  .content { max-width: 760px; margin: 4rem 0; font-family: Georgia, serif; font-size: 1.2rem; }
  .content h2 { margin-top: 2.5em; }
  .people { display: grid; gap: 1rem; }
  .people article, .text-block { padding: 1.5rem; border: 1px solid var(--line); }
</style>
