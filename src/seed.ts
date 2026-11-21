// Демо-данные: вымышленные ученики и курс. Время считается от момента загрузки, чтобы «ждёт > 24 ч» было видно сразу.
import { D, H, currentModule, type Card, type CardType, type Column, type Event, type Module, type State, type Student } from './domain'

export const MODULES: Module[] = [
  { id: 'intro', title: 'Введение', days: 7 },
  { id: 'sql', title: 'SQL', days: 21 },
  { id: 'py', title: 'Python', days: 21 },
  { id: 'stat', title: 'Теорвер и статистика', days: 14 },
  { id: 'ab', title: 'A/B-тесты', days: 14 },
  { id: 'prod', title: 'Продукт', days: 14 },
  { id: 'job', title: 'Легенда, резюме, собесы', days: 14 },
]

const COURSE: [string, CardType, string, number][] = [
  ['intro', 'info', 'Настроить рабочее окружение', 1],
  ['intro', 'info', 'Созвон-знакомство с куратором', 1],
  ['intro', 'homework', 'Анкета: опыт, цель, часы в неделю', 3],
  ['sql', 'theory', 'SELECT, WHERE, ORDER BY', 3],
  ['sql', 'homework', 'Базовые запросы', 5],
  ['sql', 'theory', 'JOIN и агрегаты', 3],
  ['sql', 'homework', 'JOIN и GROUP BY', 8],
  ['sql', 'homework', 'Оконные функции', 8],
  ['sql', 'extra', 'Задачи с собеседований', 5],
  ['py', 'theory', 'Основы Python и pandas', 3],
  ['py', 'homework', 'pandas: фильтры и группировки', 5],
  ['py', 'homework', 'Визуализация', 5],
  ['py', 'homework', 'Мини-проект: разведочный анализ', 13],
  ['stat', 'theory', 'Распределения и ЦПТ', 5],
  ['stat', 'homework', 'Доверительные интервалы', 8],
  ['stat', 'homework', 'Проверка гипотез', 8],
  ['ab', 'theory', 'Дизайн эксперимента', 5],
  ['ab', 'homework', 'Размер выборки и MDE', 5],
  ['ab', 'homework', 'Анализ A/B-теста', 13],
  ['prod', 'theory', 'Продуктовые метрики', 3],
  ['prod', 'homework', 'Дерево метрик', 8],
  ['prod', 'homework', 'Кейс: упала конверсия', 8],
  ['job', 'homework', 'Резюме', 5],
  ['job', 'homework', 'Легенда', 5],
  ['job', 'info', 'Мок-собеседование', 3],
]

const DESC: Record<CardType, string> = {
  theory: 'Прочитай материал и отметь карточку выполненной. Вопросы — в комментарии куратору.',
  homework: 'Реши задачи в ноутбуке, открой доступ на просмотр и сдай ссылку на проверку. Куратор примет работу или вернёт с комментарием.',
  info: 'Организационный шаг. Когда сделано — перенеси в «Готово».',
  extra: 'Необязательно: для тех, кто хочет больше практики. На темп не влияет.',
}

type Cur = [Column, number] // колонка и сколько часов назад туда попала
interface Spec {
  id: string; name: string; startDays: number; done: number; lastDoneDays: number; cur?: Cur[]
  status?: Student['status']; contactDays?: number
}

const SPECS: Spec[] = [
  { id: 's1', name: 'Мария К.', startDays: 20, done: 6, lastDoneDays: 2, cur: [['review', 30]] },
  { id: 's2', name: 'Илья С.', startDays: 40, done: 10, lastDoneDays: 3, cur: [['review', 50], ['progress', 2]] },
  { id: 's3', name: 'Дарья О.', startDays: 12, done: 4, lastDoneDays: 1, cur: [['review', 3]] },
  { id: 's4', name: 'Тимур А.', startDays: 35, done: 6, lastDoneDays: 12, cur: [['progress', 8 * 24]] },
  { id: 's5', name: 'Олег П.', startDays: 25, done: 6, lastDoneDays: 6, cur: [['rework', 4 * 24]] },
  { id: 's6', name: 'Светлана Ч.', startDays: 60, done: 14, lastDoneDays: 1, cur: [['review', 20]] },
  { id: 's7', name: 'Вероника Б.', startDays: 50, done: 6, lastDoneDays: 1, cur: [['progress', 20]] },
  { id: 's8', name: 'Артём З.', startDays: 45, done: 8, lastDoneDays: 15, status: 'pause', contactDays: 10 },
  { id: 's9', name: 'Евгения Л.', startDays: 2, done: 1, lastDoneDays: 1, cur: [['progress', 5]] },
  { id: 's10', name: 'Роман Ф.', startDays: 88, done: 21, lastDoneDays: 1, cur: [['progress', 30]] },
]

const LINK = 'https://colab.example/notebook-demo'

export function makeSeed(now = Date.now()): State {
  const students: Student[] = []
  const cards: Card[] = []
  for (const sp of SPECS) {
    const start = now - sp.startDays * D
    const s: Student = { id: sp.id, name: sp.name, start, status: sp.status ?? 'active', contacts: [] }
    if (sp.contactDays !== undefined) {
      const at = now - sp.contactDays * D
      s.contacts.push({ at, note: 'Уехал на две недели, вернётся к модулю после отпуска', outcome: 'pause' })
      s.statusAt = at
    }
    students.push(s)
    const lastDone = now - sp.lastDoneDays * D
    COURSE.forEach(([moduleId, type, title, points], i) => {
      const c: Card = { id: `${sp.id}-${i}`, studentId: sp.id, moduleId, type, title, points, column: 'backlog', history: [], description: DESC[type] }
      const ev = (at: number, from: Column, to: Column, by: 'student' | 'curator', extra: Partial<Event> = {}) =>
        c.history.push({ at, from, to, by, ...extra })
      if (i < sp.done) {
        const t = start + ((i + 1) / sp.done) * (lastDone - start)
        ev(t - 20 * H, 'backlog', 'progress', 'student')
        if (type === 'homework') {
          ev(t - 10 * H, 'progress', 'review', 'student', { link: LINK })
          ev(t, 'review', 'done', 'curator', { comment: 'Принято, хорошая работа' })
        } else ev(t, 'progress', 'done', 'student')
        c.column = 'done'
      } else if (sp.cur && i - sp.done < sp.cur.length) {
        const [col, hours] = sp.cur[i - sp.done]
        const t = now - hours * H
        if (col === 'progress') ev(t, 'backlog', 'progress', 'student')
        if (col === 'review' || col === 'rework') {
          ev(t - 30 * H, 'backlog', 'progress', 'student')
          ev(col === 'review' ? t : t - 20 * H, 'progress', 'review', 'student', { link: LINK })
        }
        if (col === 'rework') ev(t, 'review', 'rework', 'curator', { comment: 'В задаче 3 дубли после JOIN — проверь ключи соединения' })
        c.column = col
      }
      cards.push(c)
    })
    if (s.status !== 'active') s.statusModule = currentModule(MODULES, cards.filter(c => c.studentId === s.id))?.id
  }
  return { modules: MODULES, students, cards }
}
