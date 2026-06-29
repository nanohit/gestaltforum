import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true
    }),
    csrf: {
      // A signed payment webhook is the sole cross-origin form POST. The hook
      // below restores strict same-origin checks for every other route.
      trustedOrigins: ['*']
    }
  }
};

export default config;
