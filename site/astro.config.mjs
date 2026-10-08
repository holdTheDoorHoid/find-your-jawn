import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// Hosted at https://holdthedoorhoid.github.io/find-your-jawn/ until the owner picks a domain.
export default defineConfig({
  site: 'https://holdthedoorhoid.github.io',
  base: '/find-your-jawn/',
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
  devToolbar: { enabled: false },
  integrations: [
    preact(),
    // My list is private to each visitor and the 404 page is not a page, so neither goes in the sitemap.
    sitemap({ filter: (page) => !page.includes('/my-list/') && !page.endsWith('/404.html') }),
  ],
});
