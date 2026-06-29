<script lang="ts">
  let { data, form }: { data: any; form: any } = $props();
</script>

<svelte:head><title>Вход — Gestalt.forum</title></svelte:head>

<section class="page-shell auth-shell">
  <div>
    <p class="eyebrow">Личный кабинет</p>
    <h1>С возвращением</h1>
    <p class="lede">Ваши тексты, пометки и разговоры ждут на своих местах.</p>
  </div>
  <form method="POST" class="form-card">
    {#if form?.error}<p class="error">{form.error}</p>{/if}
    <input type="hidden" name="next" value={data.next} />
    <label>
      <span>Электронная почта</span>
      <input type="email" name="email" autocomplete="email" required value={form?.email ?? ''} />
    </label>
    <label>
      <span>Пароль</span>
      <input type="password" name="password" autocomplete="current-password" required />
    </label>
    <button type="submit">Войти</button>
    <p class="muted">Ещё нет аккаунта? <a href="/auth/register">Зарегистрироваться</a></p>
  </form>
</section>

<style>
  .auth-shell {
    display: grid;
    grid-template-columns: 1fr minmax(340px, .75fr);
    gap: clamp(3rem, 8vw, 8rem);
    align-items: center;
  }

  .auth-shell h1 {
    max-width: 8ch;
  }

  @media (max-width: 760px) {
    .auth-shell {
      grid-template-columns: 1fr;
    }
  }
</style>
