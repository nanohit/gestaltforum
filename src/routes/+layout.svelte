<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';

  let { data, children } = $props();
  let menuOpen = $state(false);

  const links = [
    { href: '/materials', label: 'Материалы' },
    { href: '/volumes', label: 'Выпуски' },
    { href: '/lounge', label: 'Курилка' },
    { href: '/editors', label: 'Редакторы' },
    { href: '/submission', label: 'Подача' }
  ];
</script>

<svelte:head>
  <title>{data.siteName}</title>
  <meta
    name="description"
    content="Gestalt.forum — независимый журнал о психотерапии, культуре и человеческом опыте."
  />
</svelte:head>

{#if !page.url.pathname.startsWith('/admin')}
  <header class="site-header">
    <a class="brand" href="/" aria-label="Gestalt.forum — главная">
      <span class="brand-mark">G.</span>
      <span class="brand-name">{data.siteName}</span>
    </a>

    <button
      class="menu-button"
      type="button"
      aria-expanded={menuOpen}
      aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
      onclick={() => (menuOpen = !menuOpen)}
    >
      <span class="menu-glyph" class:open={menuOpen} aria-hidden="true">
        <span></span>
        <span></span>
      </span>
    </button>

    <nav class:open={menuOpen} aria-label="Главная навигация">
      {#each links as link}
        <a
          href={link.href}
          class:active={page.url.pathname.startsWith(link.href)}
          onclick={() => (menuOpen = false)}
        >
          {link.label}
        </a>
      {/each}
      {#if data.user}
        {#if ['admin', 'chief_editor', 'editor', 'moderator'].includes(data.user.role)}
          <a href="/admin" class:active={page.url.pathname.startsWith('/admin')}>Редакция</a>
        {/if}
        <a class="account-link" href="/account">{data.user.firstName}</a>
      {:else}
        <a class="account-link" href="/auth/login">Войти</a>
      {/if}
    </nav>
  </header>
{/if}

<main>
  {@render children()}
</main>

{#if !page.url.pathname.startsWith('/admin')}
  <footer class="site-footer">
    <div>
      <a class="brand footer-brand" href="/"><span class="brand-mark">G.</span><span class="brand-name">Gestalt.forum</span></a>
      <p>Практика внимания к человеку.</p>
    </div>
    <div class="footer-links">
      <a href="/support">Поддержка</a>
      <a href="/submission">Для авторов</a>
      <a href="/materials">Архив</a>
    </div>
    <p class="footer-year">© {new Date().getFullYear()}</p>
  </footer>
{/if}
