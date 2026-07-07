#!/bin/bash
# =======================================================================
# MeiNu — первичная настройка VM в Yandex Cloud.
#
# Запуск на свежей Ubuntu 24.04 VM после SSH-подключения:
#   curl -fsSL https://raw.githubusercontent.com/<USER>/<REPO>/main/deploy/bootstrap-vm.sh | bash -s -- <USER>/<REPO>
#
# Или вручную:
#   bash bootstrap-vm.sh VladMomet/meinu
#
# Что делает:
#  1. Обновляет систему
#  2. Ставит Node.js 20, PM2, Nginx, PostgreSQL 16, Certbot
#  3. Создаёт БД meinu и пользователя meinu
#  4. Создаёт /opt/meinu и клонирует репо в 3 подкаталога (по одному на сайт)
#  5. Устанавливает зависимости для каждого инстанса
#  6. Печатает следующие шаги
# =======================================================================

set -e

REPO="${1:-VladMomet/meinu}"
CLONE_URL="https://github.com/${REPO}.git"

DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')

echo "════════════════════════════════════════════════════════════════"
echo "  Bootstrap MeiNu VM"
echo "  Repo: $CLONE_URL"
echo "════════════════════════════════════════════════════════════════"

# --- 1. Пакеты системы ---
echo ""
echo "[1/6] Обновляем систему и ставим пакеты..."
sudo apt update
sudo apt install -y curl git nginx postgresql postgresql-contrib certbot python3-certbot-nginx build-essential ca-certificates gnupg

# --- 2. Node.js 20 ---
if ! command -v node &> /dev/null; then
  echo ""
  echo "[2/6] Ставим Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
else
  echo ""
  echo "[2/6] Node.js уже установлен: $(node --version)"
fi

# --- 3. PM2 глобально ---
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi

# --- 4. База данных ---
echo ""
echo "[3/6] Настраиваем PostgreSQL..."
sudo -u postgres psql <<PSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'meinu') THEN
    CREATE USER meinu WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE meinu OWNER meinu'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'meinu')\gexec

GRANT ALL PRIVILEGES ON DATABASE meinu TO meinu;
PSQL

# --- 5. Клонируем в 3 каталога ---
echo ""
echo "[4/6] Клонируем репозиторий в 3 каталога..."
sudo mkdir -p /opt/meinu
sudo chown -R $USER:$USER /opt/meinu

for tier in standard lite premium; do
  DIR="/opt/meinu/meinu-${tier}"
  if [ -d "$DIR/.git" ]; then
    echo "  → $DIR уже существует, pull"
    git -C "$DIR" pull
  else
    echo "  → clone в $DIR"
    git clone "$CLONE_URL" "$DIR"
  fi
done

# --- 6. Зависимости ---
echo ""
echo "[5/6] Ставим зависимости для 3 инстансов (это ~5-10 минут)..."
for tier in standard lite premium; do
  echo ""
  echo "  === meinu-${tier} ==="
  cd "/opt/meinu/meinu-${tier}"
  npm install
done

# --- 7. Скелет .env.local ---
echo ""
echo "[6/6] Создаём заготовки .env.local..."
DB_URL="postgresql://meinu:${DB_PASSWORD}@localhost:5432/meinu"

for tier in standard lite premium; do
  ENVFILE="/opt/meinu/meinu-${tier}/.env.local"
  if [ -f "$ENVFILE" ]; then
    echo "  → $ENVFILE уже есть, пропускаю"
    continue
  fi

  case "$tier" in
    standard)
      SITE_LABEL=""
      AUTH_URL="https://meinu.ru"
      PORT=3000
      ;;
    lite)
      SITE_LABEL="MeiNu Lite"
      AUTH_URL="https://meinu-lite.ru"
      PORT=3001
      ;;
    premium)
      SITE_LABEL="MeiNu Premium"
      AUTH_URL="https://meinu-premium.ru"
      PORT=3002
      ;;
  esac

  cat > "$ENVFILE" <<ENV
DATABASE_URL=${DB_URL}
AUTH_SECRET=${AUTH_SECRET}

# Заполни после того как получишь бот и chat_id менеджеров:
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

SITE_TIER=${tier}
SITE_LABEL=${SITE_LABEL}
AUTH_URL=${AUTH_URL}
PORT=${PORT}
ENV
  echo "  → создан $ENVFILE"
done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ Bootstrap готов."
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "СЛЕДУЮЩИЕ ШАГИ (по порядку):"
echo ""
echo "1. Заполни TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в трёх файлах:"
echo "   nano /opt/meinu/meinu-standard/.env.local"
echo "   nano /opt/meinu/meinu-lite/.env.local"
echo "   nano /opt/meinu/meinu-premium/.env.local"
echo ""
echo "2. Создать таблицы в БД (миграция) — выполняется один раз:"
echo "   cd /opt/meinu/meinu-standard && npm run db:push"
echo ""
echo "3. Собрать все 3 инстанса (первая сборка ~15 минут):"
echo "   for tier in standard lite premium; do"
echo "     cd /opt/meinu/meinu-\$tier && npm run build"
echo "   done"
echo ""
echo "4. Запустить PM2:"
echo "   pm2 start /opt/meinu/meinu-standard/deploy/ecosystem.config.js"
echo "   pm2 save && pm2 startup"
echo "   (последняя команда напечатает ещё одну — скопируй её и запусти)"
echo ""
echo "5. Установить Nginx конфиг:"
echo "   sudo cp /opt/meinu/meinu-standard/deploy/nginx-meinu.conf /etc/nginx/sites-available/meinu"
echo "   sudo ln -sf /etc/nginx/sites-available/meinu /etc/nginx/sites-enabled/meinu"
echo "   sudo rm -f /etc/nginx/sites-enabled/default"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "6. Настроить DNS каждого домена в REG.RU: A-запись на IP этой VM."
echo ""
echo "7. Получить SSL (после того как DNS проросли, ~30 минут):"
echo "   sudo certbot --nginx -d meinu.ru -d www.meinu.ru"
echo "   sudo certbot --nginx -d meinu-lite.ru -d www.meinu-lite.ru"
echo "   sudo certbot --nginx -d meinu-premium.ru -d www.meinu-premium.ru"
echo ""
echo "──────────────────────────────────────────────────────────────"
echo "💾 Пароль БД (сохрани в надёжном месте):"
echo "   ${DB_PASSWORD}"
echo "🔐 AUTH_SECRET уже прописан во всех трёх .env.local"
echo "──────────────────────────────────────────────────────────────"
