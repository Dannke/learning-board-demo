import { H, D, type CardType, type Status } from './domain'

export function fmtDur(ms: number): string {
  if (ms < H) return 'меньше часа'
  if (ms < 72 * H) return `${Math.floor(ms / H)} ч`
  return `${Math.floor(ms / D)} дн.`
}

export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

export const TYPE_LABEL: Record<CardType, string> = { theory: 'Теория', homework: 'Домашка', info: 'Инфо', extra: 'Доп.' }

export const STATUS_LABEL: Record<Status, string> = { active: 'Учится', pause: 'Пауза', silent: 'Молчит', left: 'Ушёл' }
