/**
 * PM2 ecosystem — 3 инстанса MeiNu на одной VM.
 *
 * Каждый инстанс — свой каталог (/opt/meinu/meinu-<tier>), свой порт
 * (3000/3001/3002), свой .env.local. База и Telegram — общие.
 *
 * Запуск:
 *   pm2 start /opt/meinu/meinu-standard/deploy/ecosystem.config.js
 *   pm2 save
 *   pm2 startup   # автозапуск при перезагрузке VM
 */

module.exports = {
  apps: [
    {
      name: 'meinu-standard',
      cwd: '/opt/meinu/meinu-standard',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        SITE_TIER: 'standard',
        PORT: '3000',
      },
    },
    {
      name: 'meinu-lite',
      cwd: '/opt/meinu/meinu-lite',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        SITE_TIER: 'lite',
        SITE_LABEL: 'MeiNu Lite',
        PORT: '3001',
      },
    },
    {
      name: 'meinu-premium',
      cwd: '/opt/meinu/meinu-premium',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        SITE_TIER: 'premium',
        SITE_LABEL: 'MeiNu Premium',
        PORT: '3002',
      },
    },
  ],
}
