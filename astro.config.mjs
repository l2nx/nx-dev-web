import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';
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

// The section was published as /l2/ before it became L2NX Core; a dynamic redirect cannot target Starlight's
// catch-all route, so each page gets its own.
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
    // The portal is dark only: a fixed base theme in the @l2nx/ui palette instead of mermaid's grey dark theme.
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
          label: 'L2NX Core',
          items: [
            'core/overview',
            'core/zero-tick-engine',
            'core/quick-start',
            'core/operations',
            'core/architecture',
            'core/engine-research',
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
          label: 'L2NX.TOP',
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
