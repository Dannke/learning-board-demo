// Чистая логика платформы: переходы, сроки, флаги риска. Время — мс (Date.now()).
export const H = 3_600_000
export const D = 24 * H
export const REVIEW_SLA = 24 * H // допущение: календарные часы, выходные не исключаются
export const SILENT_AFTER = 5 * D
export const REWORK_STALE_AFTER = 3 * D
export const LAG_ALERT_DAYS = 7
export const CONTACT_SNOOZE = 3 * D

export type Column = 'backlog' | 'progress' | 'review' | 'rework' | 'done'
export type CardType = 'theory' | 'homework' | 'info' | 'extra'
export type Role = 'student' | 'curator'
export type Status = 'active' | 'pause' | 'silent' | 'left'
export type Outcome = 'back' | 'pause' | 'silent' | 'left'

export interface Event { at: number; from: Column; to: Column; by: Role; comment?: string; link?: string }
export interface Module { id: string; title: string; days: number }
export interface Card {
  id: string; studentId: string; moduleId: string; type: CardType; title: string; points: number
  column: Column; history: Event[]; description?: string
}
export interface Contact { at: number; note: string; outcome: Outcome }
export interface Student {
  id: string; name: string; start: number; status: Status; contacts: Contact[]
  statusAt?: number; statusModule?: string
}
export interface State { modules: Module[]; students: Student[]; cards: Card[] }

export const COLUMNS: { id: Column; title: string }[] = [
  { id: 'backlog', title: 'Бэклог' },
  { id: 'progress', title: 'В работе' },
  { id: 'review', title: 'На проверке' },
  { id: 'rework', title: 'На доработке' },
  { id: 'done', title: 'Готово' },
]

// --- переходы ---
export function canMove(card: Card, to: Column, by: Role): boolean {
  const from = card.column, hw = card.type === 'homework'
  if (by === 'curator') return from === 'review' && (to === 'done' || to === 'rework')
  if (from === 'backlog') return to === 'progress'
  if (from === 'progress') return to === 'backlog' || (to === 'review' ? hw : to === 'done' && !hw)
  if (from === 'rework') return to === 'review'
  return false
}

export function move(card: Card, to: Column, by: Role, now: number, o: { comment?: string; link?: string }): Card {
  if (!canMove(card, to, by)) throw new Error(`Нельзя: ${card.column} → ${to} (${by})`)
  const comment = o.comment?.trim(), link = o.link?.trim()
  if (to === 'review' && !link) throw new Error('Нужна ссылка на решение')
  if (to === 'rework' && !comment) throw new Error('При возврате нужен комментарий')
  const ev: Event = { at: now, from: card.column, to, by }
  if (comment) ev.comment = comment
  if (link) ev.link = link
  return { ...card, column: to, history: [...card.history, ev] }
}

export const lastEventAt = (card: Card) => card.history.at(-1)?.at

// --- ожидание проверки ---
export function reviewWaitMs(card: Card, now: number): number | null {
  if (card.column !== 'review') return null
  const ev = card.history.findLast(e => e.to === 'review')
  return ev ? now - ev.at : null
}
export const isOverdue = (card: Card, now: number) => (reviewWaitMs(card, now) ?? 0) > REVIEW_SLA

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// --- темп по плану модулей ---
export function moduleDeadlines(modules: Module[], start: number): Record<string, number> {
  let t = start
  return Object.fromEntries(modules.map(m => [m.id, (t += m.days * D)]))
}

const required = (c: Card) => c.type !== 'extra'

/** Первый модуль, где есть несделанная обязательная карточка; null — курс пройден. */
export function currentModule(modules: Module[], cards: Card[]): Module | null {
  return modules.find(m => cards.some(c => c.moduleId === m.id && required(c) && c.column !== 'done')) ?? null
}

export function lagDays(student: Student, modules: Module[], cards: Card[], now: number): number {
  const m = currentModule(modules, cards)
  if (!m) return 0
  return Math.max(0, Math.floor((now - moduleDeadlines(modules, student.start)[m.id]) / D))
}

/** Где ученик должен быть по плану: индекс модуля + доля пройденного срока модуля, от 0 до modules.length − 1. */
export function planPosition(modules: Module[], start: number, now: number): number {
  let t = start
  for (let i = 0; i < modules.length; i++) {
    const end = t + modules[i].days * D
    if (now < end) return Math.min(modules.length - 1, Math.max(0, i + (now - t) / (end - t)))
    t = end
  }
  return modules.length - 1
}

export function lastStudentActivity(student: Student, cards: Card[]): number {
  return Math.max(student.start, ...cards.flatMap(c => c.history.filter(e => e.by === 'student').map(e => e.at)))
}

/** Что делать сейчас: доработка > в работе > бэклог текущего модуля. */
export function nextStep(modules: Module[], cards: Card[]): Card | null {
  const m = currentModule(modules, cards)
  return cards.find(c => c.column === 'rework')
    ?? cards.find(c => c.column === 'progress')
    ?? cards.find(c => c.column === 'backlog' && c.moduleId === m?.id && required(c))
    ?? null
}

// --- ранний сигнал ---
export type Flag =
  | { kind: 'silent'; days: number }
  | { kind: 'rework'; days: number; cardId: string }
  | { kind: 'lag'; days: number }

export function riskFlags(student: Student, modules: Module[], cards: Card[], now: number): Flag[] {
  if (student.status !== 'active') return []
  const lastContact = student.contacts.at(-1)?.at
  if (lastContact !== undefined && now - lastContact < CONTACT_SNOOZE) return []
  const flags: Flag[] = []
  const idle = now - lastStudentActivity(student, cards)
  if (idle >= SILENT_AFTER && !cards.some(c => c.column === 'review'))
    flags.push({ kind: 'silent', days: Math.floor(idle / D) })
  for (const c of cards) {
    const since = c.column === 'rework' ? now - (lastEventAt(c) ?? now) : 0
    if (since >= REWORK_STALE_AFTER) flags.push({ kind: 'rework', days: Math.floor(since / D), cardId: c.id })
  }
  const lag = lagDays(student, modules, cards, now)
  if (lag >= LAG_ALERT_DAYS) flags.push({ kind: 'lag', days: lag })
  return flags
}

// --- операции над состоянием ---
export const cardsOf = (state: State, studentId: string) => state.cards.filter(c => c.studentId === studentId)

/** Возврат из паузы / молчания: план сдвигается на время отсутствия, чтобы не было ложного «отстаёт». */
export function resume(s: Student, now: number): Student {
  if (s.status === 'active') return s
  return { ...s, status: 'active', start: s.start + (now - (s.statusAt ?? now)), statusAt: now, statusModule: undefined }
}

export function addContact(state: State, studentId: string, c: { note: string; outcome: Outcome }, now: number): State {
  return {
    ...state,
    students: state.students.map(s => {
      if (s.id !== studentId) return s
      const contacts = [...s.contacts, { at: now, ...c }]
      if (c.outcome === 'back') return { ...resume(s, now), contacts }
      const mod = currentModule(state.modules, cardsOf(state, s.id))?.id
      return { ...s, status: c.outcome, statusAt: now, statusModule: mod, contacts }
    }),
  }
}

/** Ход ученика по карточке сам снимает паузу/молчание. */
export function applyMove(state: State, cardId: string, to: Column, by: Role, now: number, o: { comment?: string; link?: string }): State {
  const card = state.cards.find(c => c.id === cardId)!
  const next = move(card, to, by, now, o)
  return {
    ...state,
    cards: state.cards.map(c => (c.id === cardId ? next : c)),
    students: by === 'student' ? state.students.map(s => (s.id === card.studentId ? resume(s, now) : s)) : state.students,
  }
}
