# ✅ Что тебе сделать сейчас — настройка cat-arena

**Цель:** завести аккаунты (все с бесплатным тарифом), вписать ключи в файл **`.env.local`** в корне репозитория, потом написать мне **«продолжай»** — и я пойду делать фазы 02–08.

- 📄 Заполняешь файл `.env.local` (он уже создан, в `.gitignore` — в git не попадёт).
- 🔑 `AUTH_SECRET` и `PAIR_TOKEN_SECRET` **уже сгенерированы** — их не трогай.
- Формат строки: `ИМЯ=значение` (без пробелов вокруг `=`, без кавычек).
- Подробные пояснения — в [`docs/SETUP.md`](docs/SETUP.md).

---

## 🟢 Минимум, чтобы я начал (фаза 02) — только Neon

### 1. Neon — база данных Postgres → https://neon.tech
- [ ] Зарегистрироваться, **Create project** (регион поближе)
- [ ] Открыть **Connection Details**
- [ ] Скопировать **Pooled** строку (в хосте есть `-pooler`) → вписать в `DATABASE_URL`
- [ ] Скопировать **Direct** строку (без `-pooler`) → вписать в `DIRECT_URL`
- [ ] В конце каждой строки должно быть `?sslmode=require` (добавь, если нет)

> После этого уже можно писать «продолжай» — фазы 02 (БД + рейтинг Glicko-2) я сделаю. Остальное нужно к более поздним фазам, но раз ты решил собрать всё сразу — заведи и нижнее.

---

## 🟡 Остальные сервисы (нужны к фазам 03–08)

### 2. Upstash — Redis для анти-накрутки (фаза 03) → https://upstash.com
- [ ] Create Database → **Redis** (free tier)
- [ ] Раздел REST API → `UPSTASH_REDIS_REST_URL`
- [ ] оттуда же токен → `UPSTASH_REDIS_REST_TOKEN`

### 3. Resend — письма для входа по ссылке (фаза 05) → https://resend.com
- [ ] API Keys → Create → `RESEND_API_KEY`
- [ ] Добавить и подтвердить домен (DNS-записи), затем `EMAIL_FROM` = напр. `Cat Arena <login@твойдомен>`
      *(для локального теста без домена можно слать на свою же почту с `onboarding@resend.dev`)*
- [ ] `AUTH_URL` = адрес приложения (локально: `http://localhost:3000`)

### 4. Cloudflare R2 — хранение картинок (фаза 06) → дашборд Cloudflare → R2
- [ ] Создать bucket → имя в `R2_BUCKET`
- [ ] R2 → **Manage API Tokens** → создать (Object Read & Write) → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- [ ] `R2_ACCOUNT_ID` = твой Account ID в Cloudflare
- [ ] Включить публичный доступ / привязать домен к bucket → публичный URL в `R2_PUBLIC_URL`

### 5. Cloudflare Workers AI — авто-фильтр NSFW/«это кот?» (фаза 06)
- [ ] `CLOUDFLARE_ACCOUNT_ID` = тот же Account ID
- [ ] My Profile → **API Tokens** → создать токен с правом **Workers AI** → `CLOUDFLARE_API_TOKEN`

### 6. PostHog — аналитика (фаза 08) → https://posthog.com
- [ ] Создать проект → `NEXT_PUBLIC_POSTHOG_KEY`
- [ ] Host (напр. `https://eu.i.posthog.com`) → `NEXT_PUBLIC_POSTHOG_HOST`

### 7. Sentry — ошибки/перформанс (фаза 08) → https://sentry.io
- [ ] Создать проект **Next.js** → скопировать DSN → `SENTRY_DSN`

---

## 📋 Полный список переменных в `.env.local`

```
# уже сгенерированы — не трогать
AUTH_SECRET=...               ✅ готово
PAIR_TOKEN_SECRET=...          ✅ готово

# Neon (фаза 02)
DATABASE_URL=                  ← Neon pooled
DIRECT_URL=                    ← Neon direct

# Upstash (фаза 03)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Resend / Auth (фаза 05)
RESEND_API_KEY=
EMAIL_FROM=
AUTH_URL=http://localhost:3000

# Cloudflare R2 (фаза 06)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

# Cloudflare Workers AI (фаза 06)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# PostHog + Sentry (фаза 08)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
SENTRY_DSN=
```

---

## ▶️ Когда заполнишь (хотя бы Neon) — напиши **«продолжай»**

Я продолжу сборку subagent-driven с фазы 02 и до фазы 08. Состояние записано в память — подхвачу даже в новой сессии.
