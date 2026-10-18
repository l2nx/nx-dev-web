# nx-dev-web

Исходники портала разработчика L2NX — **https://l2nx.dev**: интеграция адаптера `nx-gs-adapter`, l2nx.top и
integration API платформы. Сайт на [Astro Starlight](https://starlight.astro.build), языки en (корень) и ru (`/ru/`).

Нашли ошибку в документации — откройте issue или PR (ссылка «Edit page» есть на каждой странице).

## Запуск

```bash
pnpm install   # @l2nx/ui из GitHub Packages: нужен токен с read:packages в user-level ~/.npmrc
pnpm dev       # http://localhost:4321
pnpm check     # biome + astro check + сборка с проверкой ссылок
```

## Структура

- `src/content/docs/` — страницы (en), `src/content/docs/ru/` — перевод.
- `openapi/<service>.json` — integration-spec сервисов. **Руками не правится**: его коммитит релиз сервиса.
- `src/content/releases/` — релизы модулей адаптера. **Руками не правится**: их коммитит publish адаптера.
- `src/styles/brand.css` — палитра Starlight из токенов `@l2nx/ui`.

Каждый push в `main` выкатывается на l2nx.dev.

## Лицензия

Apache-2.0.
