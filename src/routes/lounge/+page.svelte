<script lang="ts">
  import { apiFetch } from '$lib/client-api.svelte';
  import { sitePath } from '$lib/site-path';
  let { data }: { data: any } = $props();
  // svelte-ignore state_referenced_locally
  let threads = $state<any[]>([...data.threads]);
  let title = $state('');
  let body = $state('');
  let message = $state('');
  let creating = $state(false);

  const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '';

  async function createThread(event: SubmitEvent) {
    event.preventDefault();
    creating = true;
    const response = await apiFetch('/api/lounge/threads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
    const result = await response.json();
    creating = false;
    if (!response.ok) {
      message = result.message || 'Не удалось создать тему';
      return;
    }
    window.location.href = sitePath(`/lounge/${result.threadId}`);
  }
</script>

<svelte:head><title>Курилка — Gestalt.forum</title></svelte:head>

<section class="lounge-hero">
  <div>
    <p class="eyebrow">После чтения</p>
    <h1>Курилка</h1>
  </div>
  <p class="lede">Неспешный форум без погони за обновлениями. Новые сообщения проходят премодерацию.</p>
</section>

<section class="page-shell lounge-layout">
  <div class="thread-list">
    {#each threads as thread}
      <a href={sitePath(`/lounge/${thread.id}`)}>
        <div>
          <h2>{thread.title}</h2>
          <p>{thread.first_name} {thread.last_name}</p>
        </div>
        <div class="thread-meta">
          <strong>{thread.post_count}</strong>
          <span>сообщений</span>
          <small>{formatDate(thread.last_post_at || thread.created_at)}</small>
        </div>
      </a>
    {:else}
      <div class="empty-state">Первая тема ещё не началась.</div>
    {/each}
  </div>

  <aside>
    {#if data.isAuthenticated}
      <form class="form-card" onsubmit={createThread}>
        <h2>Новая тема</h2>
        {#if message}<p class="error">{message}</p>{/if}
        <label><span>Заголовок</span><input bind:value={title} minlength="3" maxlength="160" required /></label>
        <label><span>Первое сообщение</span><textarea bind:value={body} minlength="3" maxlength="3000" required></textarea></label>
        <button type="submit" disabled={creating}>{creating ? 'Создаём…' : 'Начать разговор'}</button>
      </form>
    {:else}
      <div class="form-card">
        <h2>Присоединиться</h2>
        <p>Для новой темы или ответа нужен аккаунт.</p>
        <a class="button" href={sitePath("/auth/login?next=/lounge")}>Войти</a>
      </div>
    {/if}
  </aside>
</section>

<style>
  .lounge-hero {
    padding: clamp(3.5rem, 7vw, 6.5rem) max(1.5rem, calc((100vw - 1180px) / 2));
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 520px);
    align-items: center;
    gap: clamp(2rem, 6vw, 5rem);
    background: var(--forest);
    color: #f6efe5;
  }

  .lounge-hero .eyebrow { color: #e8a08a; }

  .lounge-hero .lede {
    color: rgba(246, 239, 229, .78);
    margin: 0;
    max-width: 17em;
  }

  .lounge-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
    gap: clamp(1.8rem, 4vw, 3rem);
    align-items: start;
  }

  .lounge-layout > * {
    min-width: 0;
  }

  aside {
    position: sticky;
    top: 2rem;
    min-width: 0;
  }

  aside .form-card {
    width: 100%;
    max-width: none;
    padding: clamp(1.4rem, 3vw, 2rem);
  }

  aside .form-card h2 {
    margin: 0 0 .75rem;
    font-size: clamp(1.85rem, 2.2vw, 2.25rem);
    line-height: 1.08;
    overflow-wrap: normal;
    word-break: normal;
    hyphens: none;
  }

  aside .button,
  aside button {
    width: 100%;
  }

  .thread-list {
    border-top: 1px solid var(--line);
    min-width: 0;
  }

  .thread-list > a {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: clamp(1rem, 3vw, 2rem);
    padding: 1.7rem 0;
    border-bottom: 1px solid var(--line);
    text-decoration: none;
  }

  .thread-list h2 { margin: 0 0 .5rem; font-size: clamp(1.5rem, 3vw, 2.2rem); }
  .thread-list a:hover h2 { color: var(--accent); }
  .thread-list p { margin: 0; color: var(--muted); font-size: .82rem; }
  .thread-meta { min-width: 110px; text-align: right; display: grid; }
  .thread-meta strong { font-family: Georgia, serif; font-size: 2rem; }
  .thread-meta span, .thread-meta small { color: var(--muted); font-size: .72rem; }

  .thread-list .empty-state {
    padding: clamp(3rem, 8vw, 5rem) 1rem;
    background:
      linear-gradient(135deg, rgba(255,253,248,.55), rgba(233,225,211,.25));
  }

  @media (max-width: 920px) {
    .lounge-hero {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .lounge-hero .lede {
      max-width: 26rem;
    }

    .lounge-layout {
      grid-template-columns: 1fr;
    }

    aside {
      position: static;
    }
  }

  @media (max-width: 620px) {
    .lounge-hero {
      padding: 3.4rem 1.5rem 4rem;
    }

    .thread-list > a {
      grid-template-columns: 1fr;
    }

    .thread-meta {
      min-width: 0;
      text-align: left;
      display: flex;
      align-items: baseline;
      gap: .5rem;
      flex-wrap: wrap;
    }

    .thread-meta strong {
      font-size: 1.5rem;
    }
  }
</style>
