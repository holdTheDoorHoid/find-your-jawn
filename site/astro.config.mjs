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
  integrations: [preact(), sitemap()],
});
