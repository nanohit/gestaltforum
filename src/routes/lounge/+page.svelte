<script lang="ts">
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
    const response = await fetch('/api/lounge/threads', {
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
    window.location.href = `/lounge/${result.threadId}`;
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
      <a href={`/lounge/${thread.id}`}>
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
        <a class="button" href="/auth/login?next=/lounge">Войти</a>
      </div>
    {/if}
  </aside>
</section>

<style>
  .lounge-hero {
    padding: clamp(4rem, 10vw, 9rem) max(1.5rem, calc((100vw - 1180px) / 2));
    display: grid;
    grid-template-columns: 1fr .8fr;
    align-items: end;
    gap: 3rem;
    background: var(--forest);
    color: #f6efe5;
  }
  .lounge-hero .eyebrow { color: #e8a08a; }
  .lounge-layout { display: grid; grid-template-columns: 1fr 360px; gap: 3rem; align-items: start; }
  aside { position: sticky; top: 2rem; }
  .thread-list { border-top: 1px solid var(--line); }
  .thread-list > a {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2rem;
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
  @media (max-width: 820px) {
    .lounge-hero, .lounge-layout { grid-template-columns: 1fr; }
    aside { position: static; order: -1; }
  }
</style>
