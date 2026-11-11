// Paths resolve from the working directory: pages using this module are bundled, so import.meta.url moves.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const openApiDir = resolve(process.cwd(), 'openapi');

export const API_LOCALES = [
  { locale: undefined, lang: 'en' },
  { locale: 'ru', lang: 'ru' },
];

// Tenants first: its server list yields the serverId / Server-Slug the other services take. The rest alphabetical.
const SERVICE_ORDER = ['tenants'];

const rank = (service) => {
  const index = SERVICE_ORDER.indexOf(service);
  return index < 0 ? SERVICE_ORDER.length : index;
};

export function apiServices() {
  return readdirSync(openApiDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function specFile(service, lang) {
  const russian = resolve(openApiDir, 'ru', `${service}.json`);
  return lang === 'ru' && existsSync(russian) ? russian : resolve(openApiDir, `${service}.json`);
}

export function specText(service, lang) {
  return readFileSync(specFile(service, lang), 'utf8');
}

export function readSpec(service, lang) {
  return JSON.parse(specText(service, lang));
}

export function specTitle(service, lang) {
  return readSpec(service, lang).info?.title ?? service;
}

export function apiStaticPaths() {
  return API_LOCALES.flatMap(({ locale, lang }) =>
    apiServices().map((service) => ({ params: { locale, service }, props: { lang } })),
  );
}

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'];

const plain = (markdown) =>
  markdown
    ?.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Anchors are the contract between the sidebar links, the hidden Pagefind index and scrollToOperation.
export function apiOperations(service, lang) {
  const spec = readSpec(service, lang);
  const entries = (items, webhook) =>
    Object.entries(items ?? {}).flatMap(([name, item]) =>
      METHODS.filter((method) => item[method]).map((method) => ({
        anchor: webhook ? `op-webhook-${name}` : `op-${method}-${name}`,
        label: webhook ? `webhook ${name}` : `${method.toUpperCase()} ${name}`,
        summary: item[method].summary,
        description: plain(item[method].description),
      })),
    );
  return [...entries(spec.paths, false), ...entries(spec.webhooks, true)];
}
