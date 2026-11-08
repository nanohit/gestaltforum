<script lang="ts">
  import { sitePath } from '$lib/site-path';
  let { children } = $props();
  const links = [
    ['#overview', 'Обзор'],
    ['#articles', 'Материалы'],
    ['#volumes', 'Выпуски'],
    ['#moderation', 'Модерация'],
    ['#pages', 'Страницы'],
    ['#users', 'Пользователи'],
    ['#support', 'Поддержка'],
    ['#operations', 'Система']
  ];
</script>

<div class="admin-frame">
  <aside class="admin-sidebar">
    <a class="admin-brand" href={sitePath("/admin")}>Редакция</a>
    <nav>
      {#each links as link}<a href={sitePath(`/admin${link[0]}`)}>{link[1]}</a>{/each}
    </nav>
    <a href={sitePath("/")}>← На сайт</a>
  </aside>
  <div class="admin-content">
    {@render children()}
  </div>
</div>

<style>
  .admin-frame { min-height: 100vh; display: grid; grid-template-columns: 230px minmax(0, 1fr); background: #f7f5ef; }
  .admin-sidebar {
    position: sticky; top: 0; height: 100vh; padding: 2rem 1.2rem;
    display: flex; flex-direction: column; gap: 2rem; background: #24241f; color: #f4f0e8;
  }
  .admin-brand { font-family: Georgia, serif; font-size: 1.7rem; text-decoration: none; }
  .admin-sidebar nav { display: grid; gap: .3rem; }
  .admin-sidebar nav a { padding: .55rem .7rem; border-radius: .25rem; text-decoration: none; color: #c9c1b4; }
  .admin-sidebar nav a:hover { background: #3a3932; color: white; }
  .admin-sidebar > a:last-child { margin-top: auto; color: #c9c1b4; }
  .admin-content { min-width: 0; }
  @media (max-width: 800px) {
    .admin-frame { grid-template-columns: 1fr; }
    .admin-sidebar { position: static; height: auto; }
    .admin-sidebar nav { display: flex; overflow-x: auto; }
    .admin-sidebar > a:last-child { display: none; }
  }
</style>
