/** MN-YYMMDD-NNN для заказов, CR-YYMMDD-NNN для заявок */
export function makeId(prefix: 'MN' | 'CR'): string {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${yy}${mm}${dd}-${rand}`;
}
