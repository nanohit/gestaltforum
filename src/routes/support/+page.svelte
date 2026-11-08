<script lang="ts">
  import { sitePath } from '$lib/site-path';
  let { data, form }: { data: any; form: any } = $props();
</script>

<svelte:head><title>Поддержка — Gestalt.forum</title></svelte:head>

<section class="page-shell support-shell">
  <div>
    <p class="eyebrow">Поддержка</p>
    <h1>Давайте разберёмся</h1>
    <p class="lede">Опишите вопрос как удобно. Обращение попадёт редакции, и мы ответим по электронной почте.</p>
  </div>
  {#if form?.success}
    <div class="form-card">
      <p class="eyebrow">Получено</p>
      <h2>Обращение №{form.ticketId} создано</h2>
      <p>Спасибо. Статус можно увидеть в личном кабинете.</p>
      <a class="button" href={sitePath("/account#payments")}>В кабинет</a>
    </div>
  {:else}
    <form method="POST" class="form-card">
      {#if form?.error}<p class="error">{form.error}</p>{/if}
      <label>
        <span>Тема</span>
        <input name="subject" maxlength="160" required value={form?.values?.subject ?? data.subject} />
      </label>
      <label>
        <span>Сообщение</span>
        <textarea name="body" maxlength="5000" minlength="10" required>{form?.values?.body ?? ''}</textarea>
      </label>
      <button type="submit">Отправить</button>
    </form>
  {/if}
</section>

<style>
  .support-shell { display: grid; grid-template-columns: 1fr minmax(340px, .8fr); gap: clamp(3rem, 8vw, 8rem); align-items: start; }
  .support-shell h1 { max-width: 8ch; }
  @media (max-width: 760px) { .support-shell { grid-template-columns: 1fr; } }
</style>
