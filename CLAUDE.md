# CLAUDE.md

Developer portal l2nx.dev on Astro Starlight. The design spec is internal to the platform (this repo is public); the
maintainers know where it lives.

## Invariants

- **Public repo.** Nothing internal ever lands here, not even in history or commit messages: no internal hosts,
  container names, Kafka topics, platform DB tables, `/internal/` paths, secrets, infra, tenant names. Check before
  every commit.
- **No `pull_request` / `pull_request_target` triggers in workflows.** Jobs run on self-hosted runners; a fork PR must
  never execute code there. Contributions are reviewed and merged by maintainers.
- **English is the source, Russian a full translation** (`src/content/docs/ru/` mirrors the root file set). A page
  edit updates both locales in the same commit.
- **Bot-owned paths:** `openapi/*.json` (pushed by each service release) and `src/content/releases/**` (pushed by the
  adapter release). Never edit them by hand: the next release overwrites the file. A wrong spec is fixed in the
  service code.
- `astro.config.mjs` lists `openapi/*.json` itself: a new service appears under `/api/<service>/` without a config
  change. The OpenAPI plugin and its sidebar groups are registered only when at least one spec exists.
- Palette comes from `@l2nx/ui/theme.css` (private GitHub Packages); the accent is the logo turquoise, not the kit's.

## Pitfalls

- pnpm 11 does not expand `${GITHUB_TOKEN}` in a project `.npmrc`: the auth line lives in the user-level npmrc (locally) or
  the BuildKit secret (CI). A stale literal token in `~/.npmrc` gives 401 — use a temporary `NPM_CONFIG_USERCONFIG`.
- `astro check` does not support TypeScript 7: `typescript` stays on 6.x.
- Frontmatter values containing `: ` must be quoted, or YAML fails the build.
- Biome does not see template usage in `.astro` files: unused-variable rules are off there (`biome.json` override).

## Commands

`pnpm dev` · `pnpm check` (local gate: biome, astro check, build + link validation) · `pnpm format`.
Deploy: push to `main` → `.github/workflows/deploy.yml`.
