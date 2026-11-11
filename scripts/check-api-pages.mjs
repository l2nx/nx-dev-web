// Post-build: the links validator skips these StarlightPage routes, so a broken page or JSON would pass the build.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { apiServices } from '../src/lib/openapi-specs.mjs';

const dist = resolve(process.cwd(), 'dist');
const problems = [];

for (const service of apiServices()) {
  for (const prefix of ['', 'ru/']) {
    const page = resolve(dist, `${prefix}api/${service}/index.html`);
    const json = resolve(dist, `${prefix}api/${service}/openapi.json`);
    if (!existsSync(page)) {
      problems.push(`missing ${prefix}api/${service}/index.html`);
    }
    if (!existsSync(json)) {
      problems.push(`missing ${prefix}api/${service}/openapi.json`);
    } else {
      try {
        if (!JSON.parse(readFileSync(json, 'utf8')).openapi) {
          problems.push(`${prefix}api/${service}/openapi.json is not an OpenAPI document`);
        }
      } catch {
        problems.push(`${prefix}api/${service}/openapi.json is not JSON`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`API reference pages are incomplete:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`API reference pages: ${apiServices().length} services in en and ru`);
