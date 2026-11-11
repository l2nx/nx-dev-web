import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';
import { apiOperations, apiServices, specTitle } from './src/lib/openapi-specs.mjs';

const SITE = 'https://l2nx.dev';

// One group per service: its reference page, then every operation as an anchor that scrollToOperation resolves.
const apiServiceLinks = apiServices().map((service) => {
  const russian = new Map(apiOperations(service, 'ru').map((op) => [op.anchor, op.summary ?? op.label]));
  return {
    label: specTitle(service, 'en'),
    translations: { ru: specTitle(service, 'ru') },
    collapsed: true,
    items: [
      { label: 'Reference', translations: { ru: 'Справочник' }, link: `/api/${service}/` },
      ...apiOperations(service, 'en').map((op) => ({
        label: op.summary ?? op.label,
        translations: { ru: russian.get(op.anchor) ?? op.summary ?? op.label },
        link: `/api/${service}/#${op.anchor}`,
      })),
    ],
  };
});

// The validator cannot resolve these StarlightPage routes (InvalidLinkToCustomPage); other /api/ links stay checked.
const apiReferenceRoutes = apiServices().flatMap((service) =>
  ['', '/ru'].flatMap((prefix) => [`${prefix}/api/${service}/`, `${prefix}/api/${service}/openapi.json`]),
);

// Legacy /l2/ URLs: a dynamic redirect cannot target Starlight's catch-all route, so one redirect per page.
const coreDir = fileURLToPath(new URL('./src/content/docs/core/', import.meta.url));
const legacyCoreRedirects = Object.fromEntries(
  readdirSync(coreDir)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => file.replace(/\.mdx?$/, ''))
    .flatMap((page) => [
      [`/l2/${page}/`, `/core/${page}/`],
      [`/ru/l2/${page}/`, `/ru/core/${page}/`],
    ]),
);

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  redirects: legacyCoreRedirects,
  integrations: [
    // Must precede Starlight: it rewrites mermaid code blocks before Starlight renders them.
    mermaid({
      theme: 'base',
      autoTheme: false,
      mermaidConfig: {
        fontFamily: '"Onest Variable", ui-sans-serif, system-ui, sans-serif',
        themeVariables: {
          darkMode: true,
          fontSize: '16px',
          background: '#191d25',
          primaryColor: '#1f2329',
          primaryBorderColor: '#00d9d9',
          primaryTextColor: '#f0f1f4',
          secondaryColor: '#1f2329',
          tertiaryColor: '#191d25',
          lineColor: '#9a9fa6',
          textColor: '#f0f1f4',
          clusterBkg: '#14171d',
          clusterBorder: '#3a3f48',
          edgeLabelBackground: '#191d25',
          titleColor: '#c0c4cd',
          nodeTextColor: '#f0f1f4',
        },
      },
    }),
    starlight({
      title: 'L2NX Dev Portal',
      description:
        'Developer documentation for the L2NX platform: L2NX Core, game server adapter, l2nx.top, integration API.',
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
          label: 'User guide',
          translations: { ru: 'Руководство' },
          items: ['guide/search'],
        },
        {
          label: 'L2NX Core',
          items: [
            'core/overview',
            'core/zero-tick-engine',
            'core/quick-start',
            'core/operations',
            'core/architecture',
            'core/engine-research',
            {
              label: 'Features',
              translations: { ru: 'Функции' },
              collapsed: true,
              items: [{ autogenerate: { directory: 'core/features' } }],
            },
            'core/glossary',
            'core/licensing',
          ],
        },
        {
          label: 'GS Adapter',
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
          label: 'Wiki',
          items: [
            'wiki/search',
            {
              label: 'Articles',
              translations: { ru: 'Статьи' },
              items: ['wiki/articles/ai-translation'],
            },
          ],
        },
        {
          label: 'L2NX.TOP',
          items: ['top/overview', 'top/vote-link', 'top/webhooks', 'top/getting-access'],
        },
        {
          label: 'Integration API',
          translations: { ru: 'Integration API' },
          items: ['api/overview', 'api/authentication', ...apiServiceLinks],
        },
        { slug: 'support' },
      ],
      plugins: [
        starlightLinksValidator({ exclude: apiReferenceRoutes }),
        starlightLlmsTxt({ projectName: 'L2NX', description: 'Developer documentation for the L2NX platform.' }),
      ],
    }),
  ],
});
