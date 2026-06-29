<script lang="ts">
  let { form }: { form: any } = $props();
</script>

<svelte:head><title>Регистрация — Gestalt.forum</title></svelte:head>

<section class="page-shell auth-shell">
  <div>
    <p class="eyebrow">Новый читатель</p>
    <h1>Соберите свой архив</h1>
    <p class="lede">Сохраняйте материалы, делайте заметки и присоединяйтесь к разговору.</p>
  </div>
  <form method="POST" class="form-card">
    {#if form?.error}<p class="error">{form.error}</p>{/if}
    <div class="form-row">
      <label>
        <span>Имя</span>
        <input name="firstName" autocomplete="given-name" required value={form?.values?.firstName ?? ''} />
      </label>
      <label>
        <span>Фамилия</span>
        <input name="lastName" autocomplete="family-name" required value={form?.values?.lastName ?? ''} />
      </label>
    </div>
    <label>
      <span>Электронная почта</span>
      <input type="email" name="email" autocomplete="email" required value={form?.values?.email ?? ''} />
    </label>
    <label>
      <span>Телефон</span>
      <input type="tel" name="phone" autocomplete="tel" required value={form?.values?.phone ?? ''} />
    </label>
    <label>
      <span>Пароль — не менее 10 символов</span>
      <input type="password" name="password" autocomplete="new-password" minlength="10" required />
    </label>
    <button type="submit">Создать аккаунт</button>
    <p class="muted">Уже зарегистрированы? <a href="/auth/login">Войти</a></p>
  </form>
</section>

<style>
  .auth-shell {
    display: grid;
    grid-template-columns: 1fr minmax(360px, .8fr);
    gap: clamp(3rem, 8vw, 8rem);
    align-items: center;
  }
  .auth-shell h1 { max-width: 9ch; }
  @media (max-width: 760px) { .auth-shell { grid-template-columns: 1fr; } }
</style>
