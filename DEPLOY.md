# Деплой MeiNu на Yandex Cloud

Тебе понадобятся:
- ✅ Аккаунт в **Yandex Cloud** (можно завести через Яндекс ID)
- ✅ **3 домена** в REG.RU: `meinu.ru`, `meinu-lite.ru`, `meinu-premium.ru`
- ✅ Telegram-бот и chat_id менеджеров (уже есть)
- ✅ Репозиторий на GitHub со всеми файлами

Общее время: **2–3 часа**, из которых полчаса занимает распространение DNS.

---

## Шаг 1. Заливаем код на GitHub

Такой же путь как раньше:

1. Открой репозиторий `github.com/<твой-username>/meinu`
2. Удали `public/index.html` (если он там ещё есть от Vercel-версии)
3. **«Add file → Upload files»** → перетащи ВСЁ содержимое папки `meinu-vm/` (кроме `.next`, `node_modules`)
4. Commit message: `feat: 3 sites + Yandex Cloud deploy`
5. Commit changes

Важно чтобы залились папки `deploy/` и `public/` с тремя `index-*.html`.

---

## Шаг 2. Создаём VM в Yandex Cloud

1. https://console.cloud.yandex.ru → войти через Яндекс ID
2. Первый раз попросит создать **облако** и **каталог** (folder) — жми «Создать», названия любые
3. Yandex Cloud даст **бесплатный грант ~4000 ₽** на первый месяц — этого хватит на месяц работы VM
4. Слева выбери сервис **Compute Cloud** → **Виртуальные машины** → зелёная кнопка **Создать ВМ**

Настройки VM:

| Раздел              | Значение                                        |
|---------------------|-------------------------------------------------|
| Имя                 | `meinu-vm`                                      |
| Зона доступности    | Любая, например `ru-central1-a`                 |
| Образ ОС            | **Ubuntu 24.04 LTS**                            |
| Диски → Загрузочный | SSD, **40 ГБ**                                  |
| Вычислительные ресурсы → Платформа | Intel Ice Lake                   |
| Гарантированная доля vCPU | **20%** (для теста)                       |
| vCPU                | **2**                                           |
| RAM                 | **4 ГБ**                                        |
| Прерываемая         | ❌ выключено                                    |
| Сетевые настройки → Публичный IPv4 | **Автоматически** (даст статический IP) |
| Доступ → SSH-ключ   | Создать пару ключей или загрузить готовый       |
| Доступ → Логин      | `meinu` (не `root` — это важно)                 |

Если у тебя нет SSH-ключа:
- **Mac / Linux:** в терминале `ssh-keygen -t ed25519 -C "meinu-vm"` → нажимай Enter на все вопросы → потом `cat ~/.ssh/id_ed25519.pub` → скопируй вывод → вставь в поле «SSH-ключ»
- **Windows:** используй PuTTYgen или установи Windows Terminal + OpenSSH

Прокрути вниз, нажми **Создать ВМ**.

Через 1–2 минуты VM появится в списке со статусом **Running** и **публичным IPv4** — запиши этот IP, он понадобится ниже. Например `130.193.58.48`.

---

## Шаг 3. Подключаемся к VM

**Mac / Linux — терминал:**
```
ssh meinu@<IP-VM>
```
Введи passphrase от ключа (если задавал).

**Windows:**
- PowerShell: `ssh meinu@<IP-VM>`
- Или PuTTY: Host = `<IP-VM>`, User = `meinu`, Auth → указать `.ppk`-ключ

Первый раз спросит про fingerprint — отвечай `yes`.

Если увидел приглашение вида `meinu@meinu-vm:~$` — ты внутри.

---

## Шаг 4. Запускаем bootstrap-скрипт

Внутри VM (`meinu@meinu-vm:~$`) вставь и выполни (замени `<GITHUB-USER>` на свой ник):

```bash
curl -fsSL https://raw.githubusercontent.com/<GITHUB-USER>/meinu/main/deploy/bootstrap-vm.sh | bash -s -- <GITHUB-USER>/meinu
```

Скрипт минут 10:
- обновит систему, поставит Node 20, PM2, Nginx, Postgres 16, certbot
- создаст БД `meinu` и пользователя
- клонирует репо в 3 каталога: `/opt/meinu/meinu-standard`, `.../meinu-lite`, `.../meinu-premium`
- поставит зависимости для каждого
- создаст три `.env.local` с готовыми `DATABASE_URL`, `AUTH_SECRET`

В самом конце напечатает **пароль БД** — скопируй в надёжное место.

---

## Шаг 5. Дозаполняем .env.local

Осталось вписать Telegram-токен в каждый из трёх файлов:

```bash
nano /opt/meinu/meinu-standard/.env.local
```

Найди строки:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Вставь значения (те же, что были на Vercel). Сохрани: `Ctrl+O`, Enter, `Ctrl+X`.

**Повтори для двух других файлов** — токен и chat_id одинаковые для всех трёх, отличаются только `SITE_TIER`, `SITE_LABEL`, `AUTH_URL`, `PORT` (их скрипт уже прописал правильно):

```bash
nano /opt/meinu/meinu-lite/.env.local
nano /opt/meinu/meinu-premium/.env.local
```

---

## Шаг 6. Создаём таблицы в БД

Одной командой (запустится один раз, применится ко всем трём — БД у нас общая):

```bash
sudo -u postgres psql meinu -f /opt/meinu/meinu-standard/deploy/init-db.sql
```

Должно напечатать 3 × `CREATE TYPE` и 3 × `CREATE TABLE` (или `NOTICE ... already exists` при повторном запуске).

Проверить:
```bash
sudo -u postgres psql meinu -c '\dt'
```
Ждём три таблицы: `users`, `orders`, `inquiries`.

---

## Шаг 7. Первая сборка (15 минут)

```bash
for tier in standard lite premium; do
  echo "=== meinu-$tier ==="
  cd /opt/meinu/meinu-$tier
  npm run build
done
```

Три раза подряд `npm run build`. Каждая сборка 3–5 минут. В конце каждой — блок «✓ Compiled successfully» и таблица роутов. Если увидишь красным `Failed to compile` — присылай мне текст ошибки.

---

## Шаг 8. Запускаем PM2

```bash
pm2 start /opt/meinu/meinu-standard/deploy/ecosystem.config.js
pm2 save
pm2 startup
```

Последняя команда напечатает **ещё одну команду вида** `sudo env PATH=... pm2 startup ...` — **скопируй её и запусти**. Это регистрация PM2 как systemd-сервиса (автозапуск при перезагрузке VM).

Проверь:
```bash
pm2 status
```
Три строки: `meinu-standard`, `meinu-lite`, `meinu-premium` — все со статусом **online** и малой uptime.

Быстрая проверка что сайты отвечают:
```bash
curl -I http://localhost:3000
curl -I http://localhost:3001
curl -I http://localhost:3002
```
Каждый должен ответить `HTTP/1.1 200 OK`.

---

## Шаг 9. Устанавливаем Nginx

```bash
sudo cp /opt/meinu/meinu-standard/deploy/nginx-meinu.conf /etc/nginx/sites-available/meinu
sudo ln -sf /etc/nginx/sites-available/meinu /etc/nginx/sites-enabled/meinu
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` должно ответить `syntax is ok` и `test is successful`.

---

## Шаг 10. DNS в REG.RU

Открой https://www.reg.ru → войди в аккаунт → **Мои домены**.

Для **каждого из трёх** доменов (meinu.ru, meinu-lite.ru, meinu-premium.ru):

1. Клик по домену → **DNS-серверы и управление зоной**
2. Убедись что стоят DNS-серверы REG.RU (`ns1.reg.ru`, `ns2.reg.ru`) — если нет, поставь
3. В таблице записей добавь/поправь:

| Тип   | Имя    | Значение     | Приоритет |
|-------|--------|--------------|-----------|
| A     | @      | `<IP-VM>`    | –         |
| A     | www    | `<IP-VM>`    | –         |

Сохрани. DNS распространяются 15–60 минут (иногда до 24 часов).

Проверить (на своём компьютере):
```
ping meinu.ru
```
Должен идти на IP твоей VM. Если ещё старый или ошибка — жди.

---

## Шаг 11. SSL через Let's Encrypt

**Только после того как DNS проросли** (ping идёт на IP VM):

```bash
sudo certbot --nginx -d meinu.ru -d www.meinu.ru
sudo certbot --nginx -d meinu-lite.ru -d www.meinu-lite.ru
sudo certbot --nginx -d meinu-premium.ru -d www.meinu-premium.ru
```

На вопросы:
- email — твой email (для уведомлений об истечении сертификата)
- Terms — `Y`
- Newsletter — `N` (или `Y`, как хочешь)
- Redirect HTTP → HTTPS — `2` (Yes, редирект)

Certbot автоматически обновит Nginx-конфиг и добавит `listen 443 ssl` во все три server-блока.

Проверка:
```
curl -I https://meinu.ru
curl -I https://meinu-lite.ru
curl -I https://meinu-premium.ru
```
Все три должны ответить `HTTP/2 200`.

Certbot настроит автопродление сертификатов через systemd-таймер — они будут автоматически обновляться каждые 60 дней.

---

## Готово 🎉

Проверь глазами:
- https://meinu.ru — цены базовые
- https://meinu-lite.ru — цены ×1.5
- https://meinu-premium.ru — цены ×2.5

Зарегистрируй тестового пользователя, оформи заказ — в Telegram-чат менеджеров должно прилететь три разных префикса:
- **без метки** — с meinu.ru
- **🏷 MeiNu Lite** — с meinu-lite.ru
- **🏷 MeiNu Premium** — с meinu-premium.ru

---

## Полезные команды на VM

```bash
# Логи в реальном времени
pm2 logs meinu-standard
pm2 logs meinu-lite
pm2 logs meinu-premium

# Перезапуск конкретного сайта
pm2 restart meinu-lite

# Статус
pm2 status

# Обновление всех трёх после git push
/opt/meinu/meinu-standard/deploy/update.sh

# Посмотреть заказы в БД
sudo -u postgres psql meinu -c "SELECT id, city, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 20;"

# Посмотреть пользователей
sudo -u postgres psql meinu -c "SELECT id, name, phone, type, created_at FROM users ORDER BY created_at DESC LIMIT 20;"

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## Убираем Vercel и Neon

Только когда убедишься что VM-версия работает нормально (несколько дней):

**Vercel:**
1. https://vercel.com/dashboard → проект `meinu`
2. Settings → General → внизу **Delete Project**

**Neon:**
1. https://console.neon.tech → проект `meinu`
2. Settings → **Delete Project**
