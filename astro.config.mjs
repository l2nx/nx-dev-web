import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';

const SITE = 'https://l2nx.dev';

const openApiDir = fileURLToPath(new URL('./openapi/', import.meta.url));
const openApiSchemas = readdirSync(openApiDir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => {
    const service = file.slice(0, -'.json'.length);
    const { info } = JSON.parse(readFileSync(`${openApiDir}${file}`, 'utf8'));
    return { base: `api/${service}`, schema: `./openapi/${file}`, sidebar: { label: info?.title ?? service } };
  });

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'L2NX Dev Portal',
      description: 'Developer documentation for the L2NX platform: game server adapter, l2nx.top, integration API.',
      logo: { src: './src/assets/logo.png', alt: 'L2NX' },
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      favicon: '/favicon.png',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        ru: { label: 'Русский', lang: 'ru' },
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/l2nx/nx-dev-web' }],
      editLink: { baseUrl: 'https://github.com/l2nx/nx-dev-web/edit/main/' },
      customCss: ['./src/styles/brand.css'],
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: `${SITE}/og.png` } },
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'L2NX Dev Portal' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ],
      sidebar: [
        {
          label: 'Adapter',
          translations: { ru: 'Адаптер' },
          items: [
            'adapter/overview',
            'adapter/quick-start',
            'adapter/configuration',
            {
              label: 'Modules',
              translations: { ru: 'Модули' },
              collapsed: true,
              items: [{ autogenerate: { directory: 'adapter/modules' } }],
            },
            'adapter/getting-access',
            'adapter/migration',
            'adapter/changelog',
          ],
        },
        {
          label: 'l2nx.top',
          items: ['top/overview', 'top/vote-link', 'top/webhooks', 'top/getting-access'],
        },
        {
          label: 'Integration API',
          translations: { ru: 'Integration API' },
          items: ['api/overview', 'api/authentication', ...(openApiSchemas.length > 0 ? openAPISidebarGroups : [])],
        },
        { slug: 'support' },
      ],
      plugins: [
        starlightLinksValidator(),
        starlightLlmsTxt({ projectName: 'L2NX', description: 'Developer documentation for the L2NX platform.' }),
        ...(openApiSchemas.length > 0 ? [starlightOpenAPI(openApiSchemas)] : []),
      ],
    }),
  ],
});
