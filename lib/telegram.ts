const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
// Опциональная метка сайта. Если задана — префикс идёт в начало каждого сообщения.
// Примеры значений: "MeiNu Эконом", "MeiNu Премиум". На основном сайте переменную не задаём.
const SITE_LABEL = (process.env.SITE_LABEL || '').trim();

/**
 * Отправить сообщение в Telegram-чат менеджеров.
 * Не падает, если переменные не настроены или сеть недоступна — только логирует.
 */
export async function notifyTelegram(text: string, opts?: { inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>> }) {
  if (!TG_TOKEN || !TG_CHAT) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID не настроены — пропускаю отправку');
    console.warn('[telegram] message:', text);
    return;
  }
  try {
    const body: Record<string, unknown> = {
      chat_id: TG_CHAT,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (opts?.inlineKeyboard) {
      body.reply_markup = { inline_keyboard: opts.inlineKeyboard };
    }
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.error('[telegram] send failed:', r.status, await r.text());
    }
  } catch (e) {
    console.error('[telegram] send error:', e);
  }
}

const escape = (s: string) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));

// Формирует префикс с меткой сайта. Если SITE_LABEL не задан — пустая строка.
function sitePrefix(): string {
  return SITE_LABEL ? `🏷 <i>${escape(SITE_LABEL)}</i>\n\n` : '';
}

export function formatOrderMessage(o: {
  id: string;
  city: string;
  total: number;
  items: Array<{ id: string; name: string; qty: number; price: number }>;
  user: { name: string; phone: string; email?: string | null; type: string; orgName?: string | null; inn?: string | null };
}) {
  const itemsText = o.items
    .map(i => `• <code>${i.id}</code> ${escape(i.name)} — ${i.qty} шт × ${i.price.toLocaleString('ru-RU')} ₽`)
    .join('\n');

  const userBlock = o.user.type === 'business'
    ? `<b>Юрлицо:</b> ${escape(o.user.orgName || '')}\n<b>ИНН:</b> <code>${escape(o.user.inn || '')}</code>\n<b>Контакт:</b> ${escape(o.user.name)}, ${escape(o.user.phone)}`
    : `<b>Физлицо:</b> ${escape(o.user.name)}, ${escape(o.user.phone)}`;
  const email = o.user.email ? `\n<b>E-mail:</b> ${escape(o.user.email)}` : '';

  return `${sitePrefix()}🛒 <b>Новый заказ ${o.id}</b>\n\n${userBlock}${email}\n<b>Город:</b> ${escape(o.city)}\n\n${itemsText}\n\n<b>Итого:</b> ${o.total.toLocaleString('ru-RU')} ₽`;
}

export function formatInquiryMessage(q: {
  id: string;
  description: string;
  quantity: number;
  budgetRub?: number | null;
  photosCount: number;
  user: { name: string; phone: string; email?: string | null; type: string; orgName?: string | null };
}) {
  const userBlock = q.user.type === 'business'
    ? `<b>Юрлицо:</b> ${escape(q.user.orgName || '')}, ${escape(q.user.name)}, ${escape(q.user.phone)}`
    : `<b>Физлицо:</b> ${escape(q.user.name)}, ${escape(q.user.phone)}`;
  const email = q.user.email ? `\n<b>E-mail:</b> ${escape(q.user.email)}` : '';
  const budget = q.budgetRub ? `\n<b>Бюджет:</b> до ${q.budgetRub.toLocaleString('ru-RU')} ₽ за шт` : '';

  return `${sitePrefix()}🔍 <b>Заявка на подбор ${q.id}</b>\n\n${userBlock}${email}\n<b>Количество:</b> ${q.quantity} шт${budget}\n<b>Фото-референсов:</b> ${q.photosCount}\n\n<b>Описание:</b>\n${escape(q.description)}`;
}

export function statusKeyboard(orderId: string, kind: 'order' | 'inquiry') {
  if (kind === 'order') {
    return [
      [
        { text: '✅ Подтвердить', callback_data: `o_confirmed_${orderId}` },
        { text: '🚚 В пути', callback_data: `o_shipping_${orderId}` },
      ],
      [
        { text: '📦 Получен', callback_data: `o_done_${orderId}` },
        { text: '❌ Отмена', callback_data: `o_cancelled_${orderId}` },
      ],
    ];
  }
  return [
    [
      { text: '⚙️ В работе', callback_data: `i_in_progress_${orderId}` },
      { text: '✅ Ответили', callback_data: `i_answered_${orderId}` },
    ],
    [{ text: '🔒 Закрыть', callback_data: `i_closed_${orderId}` }],
  ];
}
