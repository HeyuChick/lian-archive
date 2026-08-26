import { defineConfig } from 'astro/config';
import { remarkArchive } from './src/plugins/remark-archive.ts';

export default defineConfig({
  site: 'https://archive.heyuchick.com',
  markdown: {
    remarkPlugins: [remarkArchive],
  },
});
