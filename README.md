# cat-arena 🐱

Веб-приложение для попарного голосования и рейтинга изображений котиков.
Пользователи загружают фото котов, остальные в дуэлях 1-на-1 выбирают «кто круче»,
а рейтинг считается по системе **Glicko-2**. Картинки подсовываются умным алгоритмом,
чтобы каждая получила достаточно оценок.

## Стек
- **Next.js 15** (App Router) + TypeScript + React — фронт и бэкенд в одном проекте
- **PostgreSQL** (Neon) + **Prisma** — данные, рейтинги, голоса
- **Cloudflare R2 + CDN** — хранение и отдача картинок (egress = $0, переживает вирусный трафик)
- **Tailwind CSS** — стили
- **Auth.js** (Google OAuth) — логин нужен только для загрузки; голосование анонимное
- **Vercel** — хостинг (бесплатный тариф)

## Ключевые механики
- **Рейтинг:** Glicko-2 (рейтинг + неуверенность RD + волатильность)
- **Подбор пар:** приоритет новым/неуверенным картинкам и невиденным текущим зрителем
- **SEO:** SSR/SSG, страница на каждую картинку, лидерборд, sitemap, OG, JSON-LD

## Статус
🚧 В разработке. Дизайн-документ — в [`docs/`](docs/).

## Local development

1. `cp .env.example .env.local` and fill in the values.
2. `npm install` (runs `lefthook install` via the `prepare` script).
3. `npm run dev` — start the app at http://localhost:3000.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm test` | Vitest unit + component tests |
| `npm run test:e2e` | Playwright E2E tests (auto-starts dev server) |
| `npm run lint` | Biome lint + format check (JS/TS/JSON) |
| `npm run lint:css` | Stylelint CSS correctness |
| `npm run typecheck` | `tsc --noEmit` |
