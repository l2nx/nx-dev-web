// Paths resolve from the working directory: pages using this module are bundled, so import.meta.url moves.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const openApiDir = resolve(process.cwd(), 'openapi');

export const API_LOCALES = [
  { locale: undefined, lang: 'en' },
  { locale: 'ru', lang: 'ru' },
];

export function apiServices() {
  return readdirSync(openApiDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => file.slice(0, -'.json'.length));
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
