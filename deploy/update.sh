#!/bin/bash
# =======================================================================
# MeiNu — обновление 3 инстансов из GitHub.
#
# Запуск (после git push в main):
#   /opt/meinu/meinu-standard/deploy/update.sh
# =======================================================================

set -e

for tier in standard lite premium; do
  DIR="/opt/meinu/meinu-${tier}"
  echo ""
  echo "═══ Обновляем meinu-${tier} ═══"
  cd "$DIR"

  git pull

  # Ставим новые зависимости, если package-lock изменился
  npm install

  # Пересборка
  npm run build
done

echo ""
echo "═══ Перезапускаем PM2 ═══"
pm2 restart meinu-standard meinu-lite meinu-premium

echo ""
echo "✅ Обновление завершено."
pm2 status
