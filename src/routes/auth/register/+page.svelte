<script lang="ts">
  import { sitePath } from '$lib/site-path';
  let { form }: { form: any } = $props();
  let isVerifying = $derived(form?.step === 'verify');
  let values = $derived(form?.values ?? {});
</script>

<svelte:head><title>Регистрация — Gestalt.forum</title></svelte:head>

<section class="page-shell auth-shell">
  <div>
    <p class="eyebrow">Новый читатель</p>
    <h1>Соберите свой архив</h1>
    <p class="lede">Сохраняйте материалы, делайте заметки и присоединяйтесь к разговору.</p>
    <p class="muted">
      Регистрация подтверждается коротким кодом из письма — без отдельной вкладки и магических ссылок.
    </p>
  </div>
  <form method="POST" action={isVerifying ? '?/verify' : '?/sendCode'} class="form-card">
    {#if form?.error}<p class="error">{form.error}</p>{/if}
    {#if form?.success}<p class="success">{form.success}</p>{/if}
    {#if isVerifying}
      <input type="hidden" name="email" value={values.email ?? ''} />
      <div class="notice">
        <strong>{values.firstName} {values.lastName}</strong><br />
        <span>{values.email}</span>{#if values.phone}<span> · {values.phone}</span>{/if}
      </div>
      <label>
        <span>Код из письма</span>
        <input
          name="code"
          autocomplete="one-time-code"
          inputmode="numeric"
          enterkeyhint="done"
          placeholder="000000"
          required
        />
      </label>
      <button type="submit" formaction="?/verify">Завершить регистрацию</button>
      <button type="submit" formaction="?/resendCode" formnovalidate class="secondary">
        Отправить новый код
      </button>
    {:else}
      <div class="form-row">
        <label>
          <span>Имя</span>
          <input name="firstName" autocomplete="given-name" required value={values.firstName ?? ''} />
        </label>
        <label>
          <span>Фамилия</span>
          <input name="lastName" autocomplete="family-name" required value={values.lastName ?? ''} />
        </label>
      </div>
      <label>
        <span>Электронная почта</span>
        <input type="email" name="email" autocomplete="email" required value={values.email ?? ''} />
      </label>
      <label>
        <span>Телефон</span>
        <input type="tel" name="phone" autocomplete="tel" required value={values.phone ?? ''} />
      </label>
      <label>
        <span>Пароль — не менее 10 символов</span>
        <input type="password" name="password" autocomplete="new-password" minlength="10" required />
      </label>
      <button type="submit" formaction="?/sendCode">Получить код</button>
    {/if}
    <p class="muted">Уже зарегистрированы? <a href={sitePath("/auth/login")}>Войти</a></p>
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
