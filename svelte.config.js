import adapter from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';

const pages = process.env.DEPLOY_TARGET === 'pages';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: pages ? staticAdapter({ pages: 'build-pages', assets: 'build-pages', fallback: '404.html' }) : adapter({
      out: 'build',
      precompress: true
    }),
    ...(pages ? {
      files: { routes: 'src/browser', hooks: { server: 'src/browser/hooks.server' }, assets: 'public-assets' },
      paths: { base: process.env.PAGES_BASE || '', assets: process.env.PAGES_ASSETS || '', relative: false },
      prerender: { origin: process.env.PAGES_ORIGIN || 'https://nanohit.github.io' }
    } : {}),
    csrf: {
      // A signed payment webhook is the sole cross-origin form POST. The hook
      // below restores strict same-origin checks for every other route.
      trustedOrigins: ['*']
    }
  }
};

export default config;
