# MeiNu 美 — B2B-маркетплейс beauty из Китая

Три сайта на одной VM в Yandex Cloud:
- **meinu.ru** — основной (×2.0)
- **meinu-lite.ru** — Lite (×1.5)
- **meinu-premium.ru** — Premium (×2.5)

## Стек

- **Next.js 15** + **React 19** — SPA `public/index-*.html` + API-роуты
- **PostgreSQL 16** (локально на VM) + **Drizzle ORM**
- **PM2** — 3 процесса на портах 3000/3001/3002
- **Nginx** — реверс-прокси по доменам
- **Let's Encrypt** — SSL для всех трёх
- **JWT-сессии** (jose, httpOnly cookie)
- **Telegram-бот** — уведомления менеджерам с меткой сайта

## Структура

```
.
├── public/
│   ├── index-standard.html      ← отдаётся на meinu.ru
│   ├── index-lite.html          ← на meinu-lite.ru
│   └── index-premium.html       ← на meinu-premium.ru
├── app/api/
│   ├── register/route.ts
│   ├── auth/login/route.ts
│   ├── me/route.ts
│   ├── orders/route.ts
│   └── inquiries/route.ts
├── lib/
│   ├── db.ts                    ← локальный Postgres через node-postgres
│   ├── schema.ts
│   ├── auth.ts                  ← JWT в httpOnly куке
│   ├── telegram.ts              ← с меткой SITE_LABEL
│   └── id.ts
├── deploy/
│   ├── bootstrap-vm.sh          ← первичная настройка VM
│   ├── update.sh                ← обновление 3 инстансов из GitHub
│   ├── ecosystem.config.js      ← PM2
│   ├── nginx-meinu.conf         ← Nginx
│   └── init-db.sql              ← схема БД (идемпотентная)
├── next.config.mjs              ← rewrite / → /index-${SITE_TIER}.html
├── package.json
├── DEPLOY.md                    ← пошаговая инструкция
└── .env.example
```

## Ключевые переменные окружения

| Переменная            | Пример                                             | Комментарий                     |
|-----------------------|----------------------------------------------------|---------------------------------|
| `DATABASE_URL`        | `postgresql://meinu:PASS@localhost:5432/meinu`     | Локальная БД на VM              |
| `AUTH_SECRET`         | 48-символьная случайная строка                     | JWT-подпись                     |
| `TELEGRAM_BOT_TOKEN`  | `8944...:AAEs...`                                  | Один бот на 3 сайта             |
| `TELEGRAM_CHAT_ID`    | `-4994...`                                         | Одна группа менеджеров          |
| `SITE_TIER`           | `standard` \| `lite` \| `premium`                  | Какой HTML отдавать             |
| `SITE_LABEL`          | `MeiNu Lite` / пусто                               | Префикс в Telegram-сообщениях   |
| `PORT`                | `3000` / `3001` / `3002`                           | По инстансу                     |
| `AUTH_URL`            | `https://meinu.ru`                                 | Основной домен инстанса         |

Все переменные — в `.env.local` каждого каталога `/opt/meinu/meinu-<tier>/`.

## Развёртывание

См. `DEPLOY.md` — пошаговая инструкция от создания VM до SSL-сертификатов.

## Обновление

После `git push` в `main`:

```bash
ssh meinu@<VM-IP>
/opt/meinu/meinu-standard/deploy/update.sh
```

Скрипт сделает `git pull`, `npm install`, `npm run build`, `pm2 restart` для всех трёх инстансов.
