# CLAUDE.md

Developer portal l2nx.dev on Astro Starlight. The design spec is internal to the platform (this repo is public); the
maintainers know where it lives.

## Invariants

- **Public repo.** Nothing internal ever lands here, not even in history or commit messages: no internal hosts,
  container names, Kafka topics, platform DB tables, `/internal/` paths, secrets, infra, tenant names. Check before
  every commit.
- **No `pull_request` / `pull_request_target` triggers in workflows.** Jobs run on self-hosted runners; a fork PR must
  never execute code there. Contributions are reviewed and merged by maintainers.
- **English is the source, Russian a full translation** (`src/content/docs/ru/` mirrors the root file set). A page edit
  updates both locales in the same commit.
- **Bot-owned paths:** `openapi/*.json` and `openapi/ru/*.json` (English and Russian spec, pushed by each service
  release) and `src/content/releases/**` (pushed by the adapter release). Never edit them by hand: the next release
  overwrites the file. A wrong spec is fixed in the service code.
- **Bot-owned docs sections:** `src/content/docs/{,ru/}adapter/**` (except `changelog.mdx`, maintained here),
  `src/content/docs/{,ru/}top/**`, `src/content/docs/{,ru/}core/**`, `src/content/docs/{,ru/}wiki/**` and
  `src/content/docs/{,ru/}guide/**` are mirrored from the source repos' `docs/public/{en,ru}/` on their release (`core`,
  `wiki`, `guide`: on a change of their pages on the source trunk) by `scripts/sync-docs.sh` (denylist grep and a portal
  build before the push). `.docs-sources/<section>` holds the sha of the last synced source; a source that is its
  ancestor (rollback, old module tag) is skipped. Never edit these pages here: fix them in the source repo.
- **API reference is Scalar** (`@scalar/api-reference`, bundled; `src/components/ApiReference.astro`), one
  `StarlightPage` per service and locale (`src/pages/[...locale]/api/[service]/`), plus a static `openapi.json` next to
  it. The portal sidebar is the only menu: Scalar's own sidebar and search are off, and each service's sidebar group
  lists its operations as `#op-…` anchors (`apiOperations` in `src/lib/openapi-specs.mjs`, shared with the hidden
  Pagefind index). That module lists `openapi/*.json`, so a new service appears under `/api/<service>/` and in the
  sidebar without a config change; a service without `openapi/ru/<service>.json` shows its English spec on the Russian
  page. Scalar renders in the browser: the page also prints a hidden list of operations for Pagefind. Scalar's AI agent,
  telemetry, developer tools, Try-it and CDN fonts stay off (no external calls).
- **Term by audience:** integration API pages (`api/*`) say tenant / «тенант», linked once to "your project on the L2NX
  platform"; every other page says project / «проект».
- Palette comes from `@l2nx/ui/theme.css` (private GitHub Packages); the accent is the logo turquoise, not the kit's.

## Pitfalls

- pnpm 11 does not expand `${GITHUB_TOKEN}` in a project `.npmrc`: the auth line lives in the user-level npmrc (locally)
  or the BuildKit secret (CI). A stale literal token in `~/.npmrc` gives 401 — use a temporary `NPM_CONFIG_USERCONFIG`.
- `astro check` does not support TypeScript 7: `typescript` stays on 6.x.
- Frontmatter values containing `: ` must be quoted, or YAML fails the build.
- Biome does not see template usage in `.astro` files: unused-variable rules are off there (`biome.json` override).

## Backlog

Deferred work — GitHub issues of this repo, indexed in [`docs/TODO.md`](docs/TODO.md).

## Commands

`pnpm dev` · `pnpm check` (local gate: biome, astro check, build + link validation) · `pnpm format`. Deploy: push to
`main` → `.github/workflows/deploy.yml`.
