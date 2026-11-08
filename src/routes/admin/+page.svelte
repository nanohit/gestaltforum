<script lang="ts">
  import { apiFetch } from '$lib/client-api.svelte';
  import { sitePath } from '$lib/site-path';
  let { data, form }: { data: any; form: any } = $props();
  const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  const formatBytes = (value: number) => value > 1_000_000 ? `${(value / 1_000_000).toFixed(1)} МБ` : `${Math.round(value / 1000)} КБ`;
  const canManageUsers = $derived(['admin', 'chief_editor'].includes(data.adminUser.role));
  const canModerate = $derived(['admin', 'chief_editor', 'moderator'].includes(data.adminUser.role));
  let uploadResult = $state('');

  async function uploadImage(event: SubmitEvent) {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const response = await apiFetch('/api/admin/uploads', {
      method: 'POST',
      body: new FormData(formElement)
    });
    const result = await response.json();
    uploadResult = response.ok ? result.url : result.message || 'Не удалось загрузить изображение';
    if (response.ok) formElement.reset();
  }
</script>

<svelte:head><title>Редакция — Gestalt.forum</title></svelte:head>

<div class="admin-page">
  <header>
    <div>
      <p class="eyebrow">Gestalt.forum</p>
      <h1>Редакция</h1>
    </div>
    <p>{data.adminUser.firstName} {data.adminUser.lastName}<br /><span>{data.adminUser.role}</span></p>
  </header>

  {#if form?.error}<p class="error">{form.error}</p>{/if}
  {#if form?.success}<p class="success">Изменения сохранены.</p>{/if}

  <section id="overview" class="admin-section">
    <div class="stats">
      <article><strong>{data.stats.published}</strong><span>материалов</span></article>
      <article><strong>{data.stats.users}</strong><span>читателей</span></article>
      <article><strong>{data.stats.pending}</strong><span>на модерации</span></article>
      <article><strong>{data.stats.tickets}</strong><span>обращений</span></article>
    </div>
  </section>

  <section id="articles" class="admin-section">
    <div class="section-title">
      <div><p class="eyebrow">Контент</p><h2>Материалы</h2></div>
      <a class="button" href={sitePath("/admin/articles/new")}>Новый материал</a>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Материал</th><th>Статус</th><th>Доступ</th><th>Комментарии</th><th></th></tr></thead>
        <tbody>
          {#each data.articles as article}
            <tr>
              <td><a href={sitePath(`/admin/articles/${article.id}`)}><strong>{article.title}</strong></a><br /><small>{article.slug}</small></td>
              <td>
                <form method="POST" action="?/articleState" class="inline-form">
                  <input type="hidden" name="id" value={article.id} />
                  <select name="status" value={article.status} onchange={(event) => event.currentTarget.form?.requestSubmit()}>
                    <option value="draft">Черновик</option><option value="review">Ревью</option>
                    <option value="published">Опубликован</option><option value="archived">Архив</option>
                  </select>
                </form>
              </td>
              <td>{article.access === 'public' ? 'Открытый' : 'Подписка'}</td>
              <td>
                <form method="POST" action="?/toggleComments">
                  <input type="hidden" name="id" value={article.id} />
                  <button class="mini secondary" type="submit">{article.comments_enabled ? 'Включены' : 'Выключены'}</button>
                </form>
              </td>
              <td><a href={sitePath(`/materials/${article.slug}`)}>↗</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section id="volumes" class="admin-section">
    <div class="section-title"><div><p class="eyebrow">Архив</p><h2>Выпуски</h2></div></div>
    <div class="edit-grid">
      {#each [...data.volumes, { id: 0, slug: '', number: '', title: '', published_at: '' }] as volume}
        <form method="POST" action="?/volume" class="compact-card">
          <input type="hidden" name="id" value={volume.id} />
          <div class="form-row">
            <label><span>Номер</span><input type="number" name="number" value={volume.number} required /></label>
            <label><span>Slug</span><input name="slug" value={volume.slug} pattern="[a-z0-9-]+" required /></label>
          </div>
          <label><span>Название</span><input name="title" value={volume.title} required /></label>
          <label><span>Дата публикации (ISO)</span><input name="publishedAt" value={volume.published_at ?? ''} placeholder="2026-06-24T12:00:00Z" /></label>
          <div class="button-row">
            <button class="mini" type="submit">{volume.id ? 'Сохранить' : 'Добавить выпуск'}</button>
            {#if volume.id}
              <button class="mini danger" type="submit" formaction="?/deleteVolume">Удалить</button>
            {/if}
          </div>
        </form>
      {/each}
    </div>
  </section>

  <section id="moderation" class="admin-section">
    <div class="section-title"><div><p class="eyebrow">Сообщество</p><h2>Модерация</h2></div></div>
    {#if canModerate}
      <div class="moderation-list">
        {#each data.comments as comment}
          <article>
            <div class="meta-row">
              <strong>{comment.first_name} {comment.last_name}</strong>
              <span>{comment.target === 'thread' ? 'Курилка' : 'Материал'}: {comment.target_title}</span>
              {#if comment.reported_at}<span class="tag">Жалоба</span>{/if}
            </div>
            <p>{comment.body}</p>
            <div class="button-row">
              <form method="POST" action="?/moderate"><input type="hidden" name="id" value={comment.id} /><input type="hidden" name="status" value="approved" /><button class="mini" type="submit">Одобрить</button></form>
              <form method="POST" action="?/moderate"><input type="hidden" name="id" value={comment.id} /><input type="hidden" name="status" value="rejected" /><button class="mini danger" type="submit">Отклонить</button></form>
            </div>
          </article>
        {:else}
          <div class="empty-state">Очередь пуста.</div>
        {/each}
      </div>
    {:else}
      <p class="notice">Этот раздел доступен модератору.</p>
    {/if}
  </section>

  <section id="pages" class="admin-section">
    <div class="section-title"><div><p class="eyebrow">Конструктор</p><h2>Страницы и блоки</h2></div></div>
    <div class="page-list">
      {#each data.pages as page}
        <form method="POST" action="?/page" class="setting-row">
          <input type="hidden" name="id" value={page.id} />
          <input name="slug" value={page.slug} readonly />
          <input name="title" value={page.title} required />
          <button class="mini" type="submit">Сохранить страницу</button>
        </form>
      {/each}
    </div>
    <div class="edit-grid">
      {#each data.blocks as block}
        <form method="POST" action="?/block" class="compact-card">
          <input type="hidden" name="id" value={block.id} />
          <div class="form-row">
            <label><span>Страница</span><select name="pageId" value={block.page_id}>{#each data.pages as page}<option value={page.id}>{page.title}</option>{/each}</select></label>
            <label><span>Позиция</span><input type="number" name="position" value={block.position} /></label>
          </div>
          <label><span>Тип</span><input name="type" value={block.type} required /></label>
          <label><span>Payload JSON</span><textarea name="payload">{block.payload_json}</textarea></label>
          <div class="button-row">
            <button class="mini" type="submit">Сохранить</button>
            <button class="mini danger" type="submit" formaction="?/deleteBlock">Удалить</button>
          </div>
        </form>
      {/each}
      <form method="POST" action="?/block" class="compact-card">
        <h3>Новый блок</h3>
        <label><span>Страница</span><select name="pageId">{#each data.pages as page}<option value={page.id}>{page.title}</option>{/each}</select></label>
        <div class="form-row"><label><span>Тип</span><input name="type" value="text" required /></label><label><span>Позиция</span><input type="number" name="position" value="0" /></label></div>
        <label><span>Payload JSON</span><textarea name="payload">{'{"title":"","text":""}'}</textarea></label>
        <button class="mini" type="submit">Добавить</button>
      </form>
    </div>
  </section>

  <section id="users" class="admin-section">
    <div class="section-title"><div><p class="eyebrow">Доступ</p><h2>Пользователи</h2></div></div>
    {#if canManageUsers}
      <div class="user-list">
        {#each data.users as user}
          <details>
            <summary><strong>{user.first_name} {user.last_name}</strong><span>{user.email}</span><span class="tag">{user.role}</span><span>{user.status}</span></summary>
            <div class="user-actions">
              <form method="POST" action="?/user" class="compact-card">
                <input type="hidden" name="id" value={user.id} />
                <div class="form-row">
                  <label><span>Роль</span><select name="role" value={user.role}>{#each data.roles as role}<option value={role}>{role}</option>{/each}</select></label>
                  <label><span>Статус</span><select name="status" value={user.status}><option value="active">active</option><option value="banned">banned</option></select></label>
                </div>
                <label><span>Мьют до (ISO)</span><input name="mutedUntil" value={user.muted_until ?? ''} /></label>
                <button class="mini" type="submit">Обновить</button>
              </form>
              <form method="POST" action="?/grant" class="compact-card">
                <input type="hidden" name="userId" value={user.id} />
                <div class="form-row">
                  <label><span>Тип</span><select name="type"><option value="manual">Ручной</option><option value="grant">Грант</option></select></label>
                  <label><span>Доступ до</span><input type="datetime-local" name="endsAt" required /></label>
                </div>
                <button class="mini" type="submit">Выдать доступ</button>
                <small>Текущий максимум: {formatDate(user.entitlement_end)}</small>
              </form>
            </div>
          </details>
        {/each}
      </div>
      <h3 class="subheading">Платёжные подписки</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Пользователь</th><th>План</th><th>CloudPayments</th><th>Статус / период</th></tr></thead>
          <tbody>
            {#each data.subscriptions as subscription}
              <tr>
                <td>{subscription.first_name} {subscription.last_name}<br /><small>{subscription.email}</small></td>
                <td>{subscription.plan_title ?? '—'}</td>
                <td>{subscription.cp_subscription_id ?? '—'}</td>
                <td>
                  <form method="POST" action="?/subscription" class="subscription-form">
                    <input type="hidden" name="id" value={subscription.id} />
                    <input name="status" value={subscription.status} required />
                    <input type="datetime-local" name="periodEnd" value={subscription.period_end?.slice(0, 16) ?? ''} />
                    <button class="mini" type="submit">Обновить</button>
                  </form>
                </td>
              </tr>
            {:else}
              <tr><td colspan="4">Платёжных подписок пока нет.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}<p class="notice">Управление пользователями доступно главному редактору.</p>{/if}
  </section>

  <section id="support" class="admin-section">
    <div class="section-title"><div><p class="eyebrow">Обращения</p><h2>Поддержка</h2></div></div>
    <div class="ticket-list">
      {#each data.tickets as ticket}
        <article>
          <div class="meta-row"><strong>#{ticket.id} · {ticket.subject}</strong><span>{ticket.first_name} {ticket.last_name}</span><span>{formatDate(ticket.created_at)}</span></div>
          <p>{ticket.body}</p>
          <form method="POST" action="?/ticket" class="inline-form">
            <input type="hidden" name="id" value={ticket.id} />
            <select name="status" value={ticket.status} onchange={(event) => event.currentTarget.form?.requestSubmit()}>
              <option value="open">Открыт</option><option value="in_progress">В работе</option><option value="closed">Закрыт</option>
            </select>
          </form>
        </article>
      {/each}
    </div>
  </section>

  <section id="operations" class="admin-section">
    <div class="section-title"><div><p class="eyebrow">Эксплуатация</p><h2>Система</h2></div></div>
    <div class="operations-grid">
      <div>
        <h3>Настройки</h3>
        {#each data.settings as setting}
          <form method="POST" action="?/setting" class="setting-row">
            <input name="key" value={setting.key} readonly />
            <input name="value" value={setting.value} />
            <button class="mini" type="submit">Сохранить</button>
          </form>
        {/each}
      </div>
      <div>
        <h3>Резервные копии</h3>
        <form method="POST" action="?/backup"><button type="submit">Создать backup</button></form>
        <div class="backup-list">
          {#each data.backups as backup}
            <a href={sitePath(`/admin/backups/${backup.name}`)}><span>{backup.name}</span><small>{formatBytes(backup.size)} · {formatDate(backup.createdAt)}</small></a>
          {:else}<p class="muted">Копий пока нет.</p>{/each}
        </div>
        <h3>Загрузки</h3>
        <form enctype="multipart/form-data" class="compact-card" onsubmit={uploadImage}>
          <input type="file" name="image" accept="image/png,image/jpeg,image/webp" required />
          <button class="mini" type="submit">Загрузить изображение</button>
          {#if uploadResult}
            <label><span>Результат</span><input value={uploadResult} readonly /></label>
          {/if}
        </form>
      </div>
    </div>
  </section>
</div>

<style>
  .admin-page { width: min(1320px, calc(100% - 3rem)); margin: 0 auto; padding: 3rem 0 7rem; }
  .admin-page > header { display: flex; justify-content: space-between; gap: 2rem; align-items: start; margin-bottom: 2rem; }
  .admin-page h1 { font-size: clamp(3rem, 7vw, 6rem); }
  .admin-page > header p:last-child { text-align: right; }
  .admin-page > header span { color: var(--muted); }
  .admin-section { padding: 4rem 0; border-bottom: 1px solid var(--line); scroll-margin-top: 2rem; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--line); }
  .stats article { padding: 1.5rem; border-right: 1px solid var(--line); display: grid; }
  .stats strong { font: 3rem Georgia, serif; color: var(--accent); }
  .stats span { color: var(--muted); }
  .section-title { display: flex; justify-content: space-between; align-items: end; gap: 1rem; margin-bottom: 2rem; }
  .section-title h2 { margin: 0; }
  .inline-form select { min-width: 130px; padding: .45rem; }
  button.mini { padding: .45rem .7rem; font-size: .75rem; }
  .edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .compact-card { display: grid; gap: .75rem; padding: 1rem; border: 1px solid var(--line); background: rgba(255,255,255,.4); }
  .compact-card textarea { min-height: 7rem; font: .78rem ui-monospace, monospace; }
  .button-row { display: flex; flex-wrap: wrap; gap: .5rem; }
  .moderation-list, .ticket-list { display: grid; gap: 1rem; }
  .moderation-list article, .ticket-list article { padding: 1.3rem; border: 1px solid var(--line); background: white; }
  .moderation-list p, .ticket-list p { white-space: pre-wrap; }
  .user-list { border-top: 1px solid var(--line); }
  .user-list details { border-bottom: 1px solid var(--line); }
  .user-list summary { display: flex; gap: 1rem; align-items: center; padding: 1rem 0; cursor: pointer; }
  .user-list summary span:nth-child(2) { margin-left: auto; color: var(--muted); }
  .user-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 0 0 1rem; }
  .subheading { margin-top: 3rem; font-size: 1.7rem; }
  .subscription-form { display: grid; grid-template-columns: minmax(100px, .7fr) minmax(170px, 1fr) auto; gap: .4rem; }
  .page-list { margin-bottom: 2rem; }
  .operations-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; }
  .setting-row { display: grid; grid-template-columns: minmax(130px,.7fr) 1fr auto; gap: .4rem; margin-bottom: .5rem; }
  .backup-list { display: grid; margin: 1rem 0 2rem; }
  .backup-list a { display: flex; justify-content: space-between; gap: 1rem; padding: .7rem 0; border-bottom: 1px solid var(--line); font-size: .8rem; }
  @media (max-width: 900px) {
    .stats { grid-template-columns: repeat(2, 1fr); }
    .edit-grid, .user-actions, .operations-grid { grid-template-columns: 1fr; }
    .subscription-form { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .admin-page { width: calc(100% - 2rem); }
    .stats { grid-template-columns: 1fr; }
    .user-list summary { flex-wrap: wrap; }
    .user-list summary span:nth-child(2) { margin-left: 0; }
    .setting-row { grid-template-columns: 1fr; }
  }
</style>
