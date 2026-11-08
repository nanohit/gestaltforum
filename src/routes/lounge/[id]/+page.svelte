<script lang="ts">
  import { apiFetch } from '$lib/client-api.svelte';
  import { sitePath } from '$lib/site-path';
  import { onMount } from 'svelte';

  let { data }: { data: any } = $props();
  // svelte-ignore state_referenced_locally
  let posts = $state<any[]>([...data.posts]);
  let body = $state('');
  let message = $state('');
  let sending = $state(false);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));

  async function refresh() {
    const response = await apiFetch(`/api/lounge/posts?threadId=${data.thread.id}`);
    if (response.ok) {
      const result = await response.json();
      posts = result.posts;
    }
  }

  async function submitPost(event: SubmitEvent) {
    event.preventDefault();
    sending = true;
    const response = await apiFetch('/api/lounge/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ threadId: data.thread.id, body })
    });
    const result = await response.json();
    sending = false;
    message = result.message || (response.ok ? 'Сообщение отправлено' : 'Ошибка');
    if (response.ok) {
      body = '';
      await refresh();
    }
  }

  async function reportPost(id: number) {
    if (!confirm('Отправить сообщение модератору?')) return;
    const response = await apiFetch('/api/lounge/posts', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id })
    });
    message = response.ok ? 'Жалоба отправлена модератору' : 'Не удалось отправить жалобу';
  }

  onMount(() => {
    const timer = window.setInterval(refresh, data.pollSeconds * 1000);
    return () => window.clearInterval(timer);
  });
</script>

<svelte:head><title>{data.thread.title} — Курилка — Gestalt.forum</title></svelte:head>

<section class="thread-header">
  <a href={sitePath("/lounge")}>← Все темы</a>
  <p class="eyebrow">Курилка</p>
  <h1>{data.thread.title}</h1>
  <p>Начал разговор: {data.thread.first_name} {data.thread.last_name}</p>
</section>

<section class="narrow posts">
  {#each posts as post, index}
    <article class:pending={post.status === 'pending'}>
      <div class="post-index">{String(index + 1).padStart(2, '0')}</div>
      <div>
        <div class="meta-row">
          <strong>{post.first_name} {post.last_name}</strong>
          <span>{formatDate(post.created_at)}</span>
          {#if post.status === 'pending'}<span class="tag">На модерации</span>{/if}
        </div>
        <p>{post.body}</p>
        {#if post.status === 'approved' && data.isAuthenticated}
          <button class="report" type="button" onclick={() => reportPost(post.id)}>Пожаловаться</button>
        {/if}
      </div>
    </article>
  {/each}

  {#if data.isAuthenticated}
    <form class="reply-form" onsubmit={submitPost}>
      <h2>Ответить</h2>
      <label><span>Сообщение</span><textarea bind:value={body} minlength="2" maxlength="3000" required></textarea></label>
      <div><button type="submit" disabled={sending}>{sending ? 'Отправляем…' : 'Отправить'}</button></div>
      {#if message}<p class="muted">{message}</p>{/if}
    </form>
  {:else}
    <div class="notice"><a href={sitePath(`/auth/login?next=/lounge/${data.thread.id}`)}>Войдите</a>, чтобы ответить.</div>
  {/if}
</section>

<style>
  .thread-header {
    padding: clamp(4rem, 9vw, 8rem) max(1.5rem, calc((100vw - 900px) / 2));
    background: var(--cream);
  }
  .thread-header > a { display: inline-block; margin-bottom: 3rem; }
  .thread-header h1 { font-size: clamp(2.8rem, 7vw, 6rem); max-width: 14ch; }
  .posts { padding: 4rem 0 7rem; }
  .posts article {
    display: grid;
    grid-template-columns: 2.5rem 1fr;
    gap: 1.5rem;
    padding: 2rem 0;
    border-bottom: 1px solid var(--line);
  }
  .posts article.pending { opacity: .68; }
  .post-index { color: var(--accent); font-family: Georgia, serif; }
  .posts article p { white-space: pre-wrap; }
  .report { border: 0; padding: 0; background: transparent; color: var(--muted); text-decoration: underline; font-size: .75rem; }
  .reply-form { display: grid; gap: 1rem; margin-top: 4rem; padding: 2rem; border: 1px solid var(--line); }
  .reply-form h2 { margin: 0; }
</style>
