<script lang="ts">
  import { sitePath } from '$lib/site-path';
  import { onMount } from 'svelte';

  let { data, form }: { data: any; form: any } = $props();
  let paymentMessage = $state('');
  let cpReady = $state(false);

  const activeEntitlement = $derived(
    data.entitlements.find(
      (item: any) => new Date(item.starts_at) <= new Date() && new Date(item.ends_at) >= new Date()
    )
  );

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(value)
        )
      : '—';

  const formatMoney = (kopecks: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
      kopecks / 100
    );

  onMount(() => {
    if (!data.cloudPaymentsPublicId) return;
    if (document.querySelector('script[data-cloudpayments]')) {
      cpReady = true;
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://widget.cloudpayments.ru/bundles/cloudpayments.js';
    script.dataset.cloudpayments = '1';
    script.onload = () => (cpReady = true);
    document.head.appendChild(script);
  });

  function pay(plan: { code: string; title: string; amount: number; period: string }) {
    const CloudPayments = (window as unknown as { cp?: { CloudPayments?: new () => any } }).cp
      ?.CloudPayments;
    if (!CloudPayments) {
      paymentMessage = 'Платёжный виджет ещё загружается.';
      return;
    }
    const widget = new CloudPayments();
    const options: Record<string, unknown> = {
      publicTerminalId: data.cloudPaymentsPublicId,
      paymentSchema: 'Single',
      description: `Подписка Gestalt.forum: ${plan.title}`,
      amount: plan.amount / 100,
      currency: 'RUB',
      externalId: `gestalt-${data.profile.id}-${plan.code}-${Date.now()}`,
      userInfo: {
        accountId: String(data.profile.id),
        email: data.profile.email,
        phone: data.profile.phone,
        firstName: data.profile.first_name,
        lastName: data.profile.last_name
      },
      metadata: {
        userId: data.profile.id,
        planCode: plan.code
      }
    };
    if (plan.period === 'month') options.recurrent = { interval: 'Month', period: 1 };
    if (plan.period === 'year') options.recurrent = { interval: 'Month', period: 12 };
    widget.start(options).then(
      () => {
        paymentMessage = 'Оплата принята. Доступ появится после подтверждения платёжной системы.';
      },
      (reason: unknown) => {
        paymentMessage = 'Платёж не завершён.';
        void reason;
      }
    );
  }
</script>

<svelte:head><title>Личный кабинет — Gestalt.forum</title></svelte:head>

<section class="page-shell">
  <header class="account-header">
    <div>
      <p class="eyebrow">Личный кабинет</p>
      <h1>{data.profile.first_name}, это ваше пространство</h1>
    </div>
    <form method="POST" action={sitePath("/auth/logout")}>
      <button class="secondary" type="submit">Выйти</button>
    </form>
  </header>

  {#if data.welcome}<p class="success">Аккаунт создан. Добро пожаловать!</p>{/if}

  <nav class="account-nav" aria-label="Разделы кабинета">
    <a href="#subscription">Подписка</a>
    <a href="#saved">Сохранённое</a>
    <a href="#notes">Заметки</a>
    <a href="#profile">Профиль</a>
    <a href="#payments">Платежи</a>
  </nav>

  <section id="subscription" class="account-section">
    <div>
      <p class="eyebrow">Доступ</p>
      <h2>{activeEntitlement ? 'Подписка активна' : 'Откройте полный архив'}</h2>
      {#if activeEntitlement}
        <p>Доступ действует до {formatDate(activeEntitlement.ends_at)}.</p>
      {:else}
        <p>Подписка открывает закрытые материалы и сохраняет независимость журнала.</p>
      {/if}
    </div>
    <div class="plans">
      {#each data.plans as plan}
        <article>
          <h3>{plan.title}</h3>
          <p class="price">{formatMoney(plan.amount)}</p>
          <p class="muted">{plan.period === 'month' ? 'в месяц' : 'в год'}</p>
          {#if data.cloudPaymentsPublicId}
            <button type="button" disabled={!cpReady} onclick={() => pay(plan)}>Оформить</button>
          {:else}
            <p class="notice">Платежи отключены в локальной конфигурации.</p>
          {/if}
        </article>
      {/each}
    </div>
    {#if paymentMessage}<p class="notice">{paymentMessage}</p>{/if}
  </section>

  <section id="saved" class="account-section">
    <div>
      <p class="eyebrow">Библиотека</p>
      <h2>Сохранённое</h2>
    </div>
    {#if data.favorites.length}
      <div class="saved-list">
        {#each data.favorites as favorite}
          <article>
            <span class="tag">{favorite.kind === 'fav' ? 'Избранное' : 'На потом'}</span>
            <a href={sitePath(`/materials/${favorite.slug}`)}><h3>{favorite.title}</h3></a>
            <p>{favorite.abstract}</p>
          </article>
        {/each}
      </div>
    {:else}
      <div class="empty-state">Здесь появятся тексты, которые вы сохраните.</div>
    {/if}
  </section>

  <section id="notes" class="account-section">
    <div>
      <p class="eyebrow">Читательский след</p>
      <h2>Заметки и выделения</h2>
    </div>
    {#if data.annotations.length}
      <div class="notes-list">
        {#each data.annotations as annotation}
          <article>
            <a href={sitePath(`/materials/${annotation.slug}`)}><strong>{annotation.title}</strong></a>
            <q>{annotation.quote}</q>
            {#if annotation.note}<p>{annotation.note}</p>{/if}
          </article>
        {/each}
      </div>
    {:else}
      <div class="empty-state">Выделите фрагмент в любом материале — он останется здесь.</div>
    {/if}
  </section>

  <section id="profile" class="account-section profile-grid">
    <form method="POST" action="?/profile" class="form-card">
      <h2>Профиль</h2>
      {#if form?.profileError}<p class="error">{form.profileError}</p>{/if}
      {#if form?.profileSuccess}<p class="success">Профиль обновлён.</p>{/if}
      <div class="form-row">
        <label><span>Имя</span><input name="firstName" value={data.profile.first_name} required /></label>
        <label><span>Фамилия</span><input name="lastName" value={data.profile.last_name} required /></label>
      </div>
      <label><span>Телефон</span><input name="phone" value={data.profile.phone} required /></label>
      <label><span>Почта</span><input value={data.profile.email} disabled /></label>
      <button type="submit">Сохранить</button>
    </form>
    <form method="POST" action="?/password" class="form-card">
      <h2>Пароль</h2>
      {#if form?.passwordError}<p class="error">{form.passwordError}</p>{/if}
      {#if form?.passwordSuccess}<p class="success">Пароль обновлён.</p>{/if}
      <label><span>Текущий пароль</span><input type="password" name="currentPassword" required /></label>
      <label><span>Новый пароль</span><input type="password" name="newPassword" minlength="10" required /></label>
      <button type="submit">Сменить пароль</button>
    </form>
  </section>

  <section id="payments" class="account-section">
    <div>
      <p class="eyebrow">История</p>
      <h2>Платежи и обращения</h2>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Дата</th><th>Сумма</th><th>Статус</th><th>Транзакция</th></tr></thead>
        <tbody>
          {#each data.payments as payment}
            <tr>
              <td>{formatDate(payment.created_at)}</td>
              <td>{formatMoney(payment.amount)}</td>
              <td>{payment.status}</td>
              <td>{payment.cp_transaction_id}</td>
            </tr>
          {:else}
            <tr><td colspan="4">Платежей пока нет.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <h3 class="ticket-heading">Обращения в поддержку</h3>
    <div class="ticket-list">
      {#each data.tickets as ticket}
        <article>
          <div class="meta-row">
            <strong>#{ticket.id} · {ticket.subject}</strong>
            <span>{ticket.status}</span>
            <span>{formatDate(ticket.created_at)}</span>
          </div>
          <p>{ticket.body}</p>
        </article>
      {:else}
        <p class="muted">Обращений пока нет.</p>
      {/each}
    </div>
    <p><a href={sitePath("/support")}>Написать в поддержку →</a></p>
  </section>
</section>

<style>
  .account-header {
    display: flex;
    justify-content: space-between;
    gap: 2rem;
    align-items: start;
  }
  .account-header h1 { max-width: 12ch; font-size: clamp(3rem, 7vw, 6rem); }
  .account-nav {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    gap: 1.2rem;
    overflow-x: auto;
    margin: 3rem 0 0;
    padding: 1rem 0;
    border-block: 1px solid var(--line);
    background: var(--paper);
  }
  .account-nav a { white-space: nowrap; }
  .account-section { padding: 5rem 0; border-bottom: 1px solid var(--line); }
  .account-section > div:first-child { max-width: 700px; }
  .plans { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 2rem; }
  .plans article { padding: 2rem; border: 1px solid var(--line); background: rgba(255,255,255,.35); }
  .plans h3 { font-size: 1.6rem; margin: 0; }
  .price { font-family: Georgia, serif; font-size: 3rem; margin: 1rem 0 0; }
  .saved-list, .notes-list { display: grid; gap: 1px; margin-top: 2rem; background: var(--line); border: 1px solid var(--line); }
  .saved-list article, .notes-list article { padding: 1.5rem; background: var(--paper); }
  .saved-list h3 { margin: .7rem 0; font-size: 1.7rem; }
  .saved-list a, .notes-list a { text-decoration: none; }
  .notes-list q { display: block; margin: 1rem 0; font-family: Georgia, serif; font-size: 1.15rem; }
  .profile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .ticket-heading { margin-top: 3rem; font-size: 1.7rem; }
  .ticket-list article { padding: 1rem 0; border-bottom: 1px solid var(--line); }
  .ticket-list article p { white-space: pre-wrap; }
  @media (max-width: 760px) {
    .account-header { display: grid; }
    .plans, .profile-grid { grid-template-columns: 1fr; }
  }
</style>
