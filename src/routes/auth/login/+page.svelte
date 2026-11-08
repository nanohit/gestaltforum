<script lang="ts">
  import { sitePath } from '$lib/site-path';
  let { data, form }: { data: any; form: any } = $props();
</script>

<svelte:head><title>Вход — Gestalt.forum</title></svelte:head>

<section class="page-shell auth-shell">
  <div class="auth-copy">
    <p class="eyebrow">Личный кабинет</p>
    <h1>Вход в кабинет</h1>
    <p class="lede">Вернитесь к материалам, заметкам и разговорам без лишнего шума.</p>
    <p class="muted">Если вы только знакомитесь с журналом, регистрация займёт меньше минуты.</p>
  </div>
  <div class="auth-panel">
    <form method="POST" class="form-card">
      <div class="form-heading">
        <span>Gestalt.forum</span>
        <h2>Войти</h2>
      </div>
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
      <p class="muted">Ещё нет аккаунта? <a href={sitePath("/auth/register")}>Зарегистрироваться</a></p>
    </form>
  </div>
</section>

<style>
  .auth-shell {
    display: grid;
    grid-template-columns: minmax(0, .9fr) minmax(320px, 460px);
    gap: clamp(2.5rem, 8vw, 7rem);
    align-items: center;
    min-height: min(720px, calc(100vh - 10rem));
  }

  .auth-copy {
    max-width: 640px;
  }

  .auth-copy h1 {
    max-width: 11ch;
    font-size: clamp(3rem, 6vw, 5.8rem);
  }

  .auth-copy .lede {
    max-width: 22em;
    margin: 1.6rem 0 1rem;
  }

  .auth-copy .muted {
    max-width: 30rem;
  }

  .auth-panel {
    min-width: 0;
  }

  .auth-panel .form-card {
    width: 100%;
    max-width: none;
  }

  .form-heading {
    display: grid;
    gap: .25rem;
    margin-bottom: .25rem;
  }

  .form-heading span {
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: .16em;
    font-size: .7rem;
    font-weight: 700;
  }

  .form-heading h2 {
    margin: 0;
    font-size: clamp(2rem, 3vw, 2.8rem);
  }

  @media (max-width: 760px) {
    .auth-shell {
      grid-template-columns: 1fr;
      align-items: start;
      min-height: 0;
      gap: 2rem;
    }

    .auth-copy h1 {
      max-width: 10ch;
      font-size: clamp(2.65rem, 15vw, 4.4rem);
    }

    .auth-copy .lede {
      margin: 1.2rem 0 .8rem;
    }
  }
</style>
