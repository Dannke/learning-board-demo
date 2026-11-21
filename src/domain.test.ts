import { describe, expect, it } from 'vitest'
import {
  D, H, canMove, currentModule, isOverdue, lagDays, moduleDeadlines, move, nextStep, reviewWaitMs, riskFlags, addContact, applyMove,
  type Card, type Module, type State, type Student,
} from './domain'

const T0 = Date.UTC(2026, 0, 1)
const modules: Module[] = [
  { id: 'intro', title: 'Введение', days: 7 },
  { id: 'sql', title: 'SQL', days: 21 },
]
const student = (o: Partial<Student> = {}): Student => ({ id: 's1', name: 'Аня', start: T0, status: 'active', contacts: [], ...o })
const card = (o: Partial<Card> = {}): Card => ({
  id: 'c1', studentId: 's1', moduleId: 'intro', type: 'homework', title: 'ДЗ', points: 3, column: 'backlog', history: [], ...o,
})
const inReview = (at: number, o: Partial<Card> = {}) =>
  card({ column: 'review', history: [{ at, from: 'progress', to: 'review', by: 'student', link: 'x' }], ...o })

describe('ожидание проверки и 24 часа', () => {
  it('считает от последнего перехода в «На проверке»', () => {
    const c = card({
      column: 'review',
      history: [
        { at: T0, from: 'progress', to: 'review', by: 'student' },
        { at: T0 + H, from: 'review', to: 'rework', by: 'curator', comment: 'нет' },
        { at: T0 + 10 * H, from: 'rework', to: 'review', by: 'student' },
      ],
    })
    expect(reviewWaitMs(c, T0 + 12 * H)).toBe(2 * H)
  })
  it('не на проверке — null', () => {
    expect(reviewWaitMs(card(), T0)).toBeNull()
  })
  it('ровно 24 ч — ещё не просрочено, 24 ч + 1 мс — просрочено', () => {
    expect(isOverdue(inReview(T0), T0 + 24 * H)).toBe(false)
    expect(isOverdue(inReview(T0), T0 + 24 * H + 1)).toBe(true)
  })
})

describe('темп по плану модулей', () => {
  it('срок модуля = старт + накопленные дни', () => {
    expect(moduleDeadlines(modules, T0)).toEqual({ intro: T0 + 7 * D, sql: T0 + 28 * D })
  })
  it('текущий модуль — первый с несделанными обязательными карточками; «доп.» не держит', () => {
    const cards = [card({ column: 'done' }), card({ id: 'x', type: 'extra' }), card({ id: 'c2', moduleId: 'sql' })]
    expect(currentModule(modules, cards)?.id).toBe('sql')
    expect(currentModule(modules, [card({ column: 'done' })])).toBeNull()
  })
  it('отставание в полных днях после срока текущего модуля, не меньше 0', () => {
    const cards = [card()]
    expect(lagDays(student(), modules, cards, T0 + 5 * D)).toBe(0)
    expect(lagDays(student(), modules, cards, T0 + 7 * D + 23 * H)).toBe(0)
    expect(lagDays(student(), modules, cards, T0 + 10 * D)).toBe(3)
    expect(lagDays(student(), modules, [card({ column: 'done' })], T0 + 100 * D)).toBe(0)
  })
})

describe('флаги риска', () => {
  const kinds = (s: Student, cards: Card[], now: number) => riskFlags(s, modules, cards, now).map(f => f.kind)
  const moved = (at: number, o: Partial<Card> = {}) =>
    card({ column: 'progress', history: [{ at, from: 'backlog', to: 'progress', by: 'student' }], ...o })

  it('затих: 5 дней без движения', () => {
    expect(kinds(student(), [moved(T0)], T0 + 5 * D - 1)).toEqual([])
    expect(kinds(student(), [moved(T0)], T0 + 5 * D)).toEqual(['silent'])
  })
  it('не «затих», если его домашка ждёт проверки', () => {
    expect(kinds(student(), [inReview(T0)], T0 + 6 * D)).toEqual([])
  })
  it('без истории активность считается от старта', () => {
    expect(kinds(student(), [card()], T0 + 5 * D)).toEqual(['silent'])
  })
  it('доработка без реакции 3 дня', () => {
    const c = card({ column: 'rework', history: [{ at: T0 + 2 * D, from: 'review', to: 'rework', by: 'curator', comment: 'да' }] })
    // активность ученика была на старте, но затих не раньше 5 дней — проверяем только доработку
    expect(kinds(student(), [c, moved(T0 + 4 * D, { id: 'c9' })], T0 + 5 * D - 1)).toEqual([])
    expect(kinds(student(), [c, moved(T0 + 4 * D, { id: 'c9' })], T0 + 5 * D)).toEqual(['rework'])
  })
  it('отстаёт от темпа на 7+ дней', () => {
    const now = T0 + 14 * D
    expect(kinds(student(), [moved(now - D)], now)).toEqual(['lag'])
    expect(kinds(student(), [moved(now - D)], now - 1)).toEqual([])
  })
  it('не active или недавний контакт (< 3 дней) — флагов нет', () => {
    expect(kinds(student({ status: 'pause' }), [card()], T0 + 30 * D)).toEqual([])
    const s = student({ contacts: [{ at: T0 + 29 * D, note: '', outcome: 'back' }] })
    expect(kinds(s, [card()], T0 + 30 * D)).toEqual([])
    expect(kinds(s, [card()], T0 + 32 * D)).toContain('silent')
  })
})

describe('переходы', () => {
  it('ученик сдаёт домашку только со ссылкой', () => {
    const c = card({ column: 'progress' })
    expect(() => move(c, 'review', 'student', T0, {})).toThrow()
    expect(move(c, 'review', 'student', T0, { link: 'https://colab' }).column).toBe('review')
  })
  it('домашку нельзя перенести в «Готово» самому, теорию — можно', () => {
    expect(canMove(card({ column: 'progress' }), 'done', 'student')).toBe(false)
    expect(canMove(card({ column: 'progress', type: 'theory' }), 'done', 'student')).toBe(true)
  })
  it('куратор возвращает только с комментарием, принимает без', () => {
    const c = inReview(T0)
    expect(() => move(c, 'rework', 'curator', T0, { comment: '  ' })).toThrow()
    expect(move(c, 'rework', 'curator', T0, { comment: 'поправь JOIN' }).column).toBe('rework')
    expect(move(c, 'done', 'curator', T0, {}).column).toBe('done')
  })
  it('ученик пересдаёт с доработки; куратор не двигает чужие колонки', () => {
    expect(canMove(card({ column: 'rework' }), 'review', 'student')).toBe(true)
    expect(canMove(card({ column: 'progress' }), 'review', 'curator')).toBe(false)
    expect(canMove(inReview(T0), 'done', 'student')).toBe(false)
  })
  it('пишет историю', () => {
    const c = move(card(), 'progress', 'student', T0, {})
    expect(c.history).toEqual([{ at: T0, from: 'backlog', to: 'progress', by: 'student' }])
  })
})

describe('следующий шаг и контакт', () => {
  it('доработка важнее работы, работа важнее бэклога, бэклог — из текущего модуля', () => {
    const b = card({ id: 'b', moduleId: 'sql' }), p = card({ id: 'p', column: 'progress' }), r = card({ id: 'r', column: 'rework' })
    expect(nextStep(modules, [b, p, r])?.id).toBe('r')
    expect(nextStep(modules, [b, p])?.id).toBe('p')
    expect(nextStep(modules, [b, card({ id: 'i' })])?.id).toBe('i')
  })
  it('контакт с итогом «пауза» меняет статус и запоминает модуль', () => {
    const state: State = { modules, students: [student()], cards: [card({ column: 'done' }), card({ id: 'c2', moduleId: 'sql' })] }
    const s = addContact(state, 's1', { note: 'отпуск', outcome: 'pause' }, T0).students[0]
    expect(s).toMatchObject({ status: 'pause', statusAt: T0, statusModule: 'sql' })
    expect(s.contacts).toHaveLength(1)
  })
  it('возврат из паузы сдвигает план на её длину: нет ложного «отстаёт»', () => {
    const paused = student({ status: 'pause', statusAt: T0 + 5 * D })
    const state: State = { modules, students: [paused], cards: [card({ column: 'progress' })] }
    const back = addContact(state, 's1', { note: '', outcome: 'back' }, T0 + 25 * D).students[0]
    expect(back).toMatchObject({ status: 'active', start: T0 + 20 * D })
    expect(lagDays(back, modules, state.cards, T0 + 26 * D)).toBe(0)
  })
  it('ход ученика снимает паузу, ход куратора — нет', () => {
    const paused = student({ status: 'pause', statusAt: T0 })
    const state: State = { modules, students: [paused], cards: [card(), inReview(T0, { id: 'r' })] }
    expect(applyMove(state, 'c1', 'progress', 'student', T0 + D, {}).students[0].status).toBe('active')
    expect(applyMove(state, 'r', 'done', 'curator', T0 + D, {}).students[0].status).toBe('pause')
  })
})
