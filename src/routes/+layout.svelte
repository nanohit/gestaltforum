<script lang="ts">
  import { sitePath } from '$lib/site-path';
  import '../app.css';
  import { page } from '$app/state';
  import { base } from '$app/paths';
  const pathname = $derived(page.url.pathname.slice(base.length) || '/');

  let { data, children }: { data: any; children: import('svelte').Snippet } = $props();
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

{#if !pathname.startsWith('/admin')}
  <header class="site-header">
    <a class="brand" href={sitePath("/")} aria-label="Gestalt.forum — главная">
      <span class="brand-mark"><span>G</span></span>
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
          href={sitePath(link.href)}
          class:active={pathname.startsWith(link.href)}
          onclick={() => (menuOpen = false)}
        >
          {link.label}
        </a>
      {/each}
      {#if data.staticSite}
        <span class="muted">Журнал</span>
      {:else if data.user}
        {#if ['admin', 'chief_editor', 'editor', 'moderator'].includes(data.user.role)}
          <a href={sitePath("/admin")} class:active={pathname.startsWith('/admin')}>Редакция</a>
        {/if}
        <a class="account-link" href={sitePath("/account")}>{data.user.firstName}</a>
      {:else}
        <a class="account-link" href={sitePath("/auth/login")}>Войти</a>
      {/if}
    </nav>
  </header>
{/if}

<main>
  {@render children()}
</main>

{#if !pathname.startsWith('/admin')}
  <footer class="site-footer">
    <div>
      <a class="brand footer-brand" href={sitePath("/")}><span class="brand-mark"><span>G</span></span><span class="brand-name">Gestalt.forum</span></a>
      <p>Практика внимания к человеку.</p>
    </div>
    <div class="footer-links">
      <a href={sitePath("/support")}>Поддержка</a>
      <a href={sitePath("/submission")}>Для авторов</a>
      <a href={sitePath("/materials")}>Архив</a>
    </div>
    <p class="footer-year">© {new Date().getFullYear()}</p>
  </footer>
{/if}
