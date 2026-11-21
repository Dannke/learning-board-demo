import { useState } from 'react'
import { CardDialog } from './CardDialog'
import {
  cardsOf, currentModule, isOverdue, lagDays, lastStudentActivity, median, moduleDeadlines, reviewWaitMs, riskFlags,
  type Card, type Flag, type Outcome, type Student,
} from './domain'
import { fmtDate, fmtDur, STATUS_LABEL } from './format'
import type { App } from './store'
import { StudentView } from './StudentView'

type Tab = 'review' | 'risk' | 'students'

export function CuratorView({ app }: { app: App }) {
  const { state, now } = app
  const [tab, setTab] = useState<Tab>('review')
  const [board, setBoard] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const queue = state.cards
    .filter(c => c.column === 'review')
    .map(c => ({ c, wait: reviewWaitMs(c, now)! }))
    .sort((a, b) => b.wait - a.wait)
  const over = queue.filter(q => isOverdue(q.c, now))
  const med = median(queue.map(q => q.wait))
  const risky = state.students
    .map(s => ({ s, flags: riskFlags(s, state.modules, cardsOf(state, s.id), now) }))
    .filter(r => r.flags.length)
  const name = (id: string) => state.students.find(s => s.id === id)!.name
  const modTitle = (id?: string) => state.modules.find(m => m.id === id)?.title ?? '—'
  const open = state.cards.find(c => c.id === openId)

  if (board) return (
    <>
      <button className="ghost back" onClick={() => setBoard(null)}>← К списку</button>
      <h2>Доска: {name(board)}</h2>
      <StudentView app={app} studentId={board} role="curator" />
    </>
  )

  const queueTable = (rows: { c: Card; wait: number }[]) => (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Ученик</th><th>Задание</th><th>Модуль</th><th>Ждёт</th><th /></tr></thead>
      <tbody>{rows.map(({ c, wait }) => (
        <tr key={c.id}>
          <td>{name(c.studentId)}</td><td>{c.title}</td><td>{modTitle(c.moduleId)}</td>
          <td className={isOverdue(c, now) ? 'late' : ''}>{fmtDur(wait)}</td>
          <td><button onClick={() => setOpenId(c.id)}>Проверить</button></td>
        </tr>
      ))}</tbody>
    </table></div>
  )

  return (
    <>
      <nav className="tabs" role="tablist">
        {([['review', `Проверка (${queue.length})`], ['risk', `На грани ухода (${risky.length})`], ['students', 'Ученики']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'tab is-on' : 'tab'} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === 'review' && <section aria-label="Очередь проверки">
        <p className="summary">Ждут проверки: <b>{queue.length}</b> · дольше 24 ч: <b className={over.length ? 'late' : ''}>{over.length}</b> · медиана ожидания: <b>{med === null ? '—' : fmtDur(med)}</b></p>
        <h2>Ждут дольше 24 часов</h2>
        {over.length ? queueTable(over) : <p className="muted">Таких нет.</p>}
        <h2>Остальные в очереди</h2>
        {queue.length > over.length ? queueTable(queue.filter(q => !isOverdue(q.c, now))) : <p className="muted">Очередь пуста.</p>}
      </section>}

      {tab === 'risk' && <section aria-label="На грани ухода">
        <p className="muted">Ученики, которые не двигали карточки 5+ дней, не реагируют на доработку 3+ дня или отстают от плана на 7+ дней. Свяжитесь и отметьте итог: ученик скроется из списка на 3 дня, а статус «пауза / молчит / ушёл» сохранится с датой и модулем.</p>
        {risky.length === 0 ? <p className="muted">Сейчас никого.</p> : (
          <ul className="risk-list">{risky.map(({ s, flags }) => (
            <li key={s.id} className="risk">
              <div className="risk-head">
                <b>{s.name}</b> <span className="muted">модуль «{modTitle(currentModule(state.modules, cardsOf(state, s.id))?.id)}»</span>
                <button className="ghost" onClick={() => setBoard(s.id)}>Доска</button>
              </div>
              <ul className="flags">{flags.map((f, i) => <li key={i}>{flagText(f, state.cards)}</li>)}</ul>
              <ContactForm onSave={(n, o) => app.contact(s.id, n, o)} />
            </li>
          ))}</ul>
        )}
      </section>}

      {tab === 'students' && <section aria-label="Ученики">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Ученик</th><th>Старт</th><th>Модуль</th><th>Темп</th><th>Последнее действие</th><th>Статус</th><th /></tr></thead>
          <tbody>{state.students.map(s => <StudentRow key={s.id} s={s} app={app} onBoard={() => setBoard(s.id)} />)}</tbody>
        </table></div>
      </section>}

      {open && (
        <CardDialog key={open.id} card={open} role="curator" state={state} now={now}
          deadline={moduleDeadlines(state.modules, state.students.find(s => s.id === open.studentId)!.start)[open.moduleId]}
          onMove={(to, o) => app.moveCard(open.id, to, 'curator', o)} onClose={() => setOpenId(null)} />
      )}
    </>
  )
}

function flagText(f: Flag, cards: Card[]) {
  if (f.kind === 'silent') return `Не двигал карточки ${f.days} дн.`
  if (f.kind === 'lag') return `Отстаёт от плана на ${f.days} дн.`
  return `Доработка без реакции ${f.days} дн.: «${cards.find(c => c.id === f.cardId)?.title}»`
}

function StudentRow({ s, app, onBoard }: { s: Student; app: App; onBoard: () => void }) {
  const { state, now } = app
  const cards = cardsOf(state, s.id)
  const cur = currentModule(state.modules, cards)
  const lag = lagDays(s, state.modules, cards, now)
  const [edit, setEdit] = useState(false)
  const mod = (id?: string) => state.modules.find(m => m.id === id)?.title
  return (
    <tr>
      <td>{s.name}</td><td>{fmtDate(s.start)}</td><td>{cur?.title ?? 'пройдено'}</td>
      <td className={lag >= 7 ? 'late' : ''}>{lag ? `−${lag} дн.` : 'в графике'}</td>
      <td>{fmtDur(now - lastStudentActivity(s, cards))} назад</td>
      <td>
        {STATUS_LABEL[s.status]}{s.status !== 'active' && s.statusAt && <span className="muted"> с {fmtDate(s.statusAt)}, {mod(s.statusModule) ?? '—'}</span>}
        {edit && <ContactForm onSave={(n, o) => { app.contact(s.id, n, o); setEdit(false) }} />}
      </td>
      <td className="row-actions">
        <button className="ghost" onClick={onBoard}>Доска</button>
        {!edit && <button className="ghost" onClick={() => setEdit(true)}>Связался</button>}
      </td>
    </tr>
  )
}

function ContactForm({ onSave }: { onSave: (note: string, o: Outcome) => void }) {
  const [note, setNote] = useState('')
  const [outcome, setOutcome] = useState<Outcome>('back')
  return (
    <form className="contact" onSubmit={e => { e.preventDefault(); onSave(note.trim(), outcome) }}>
      <label className="field">Что узнали
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Например: завал на работе, вернётся в понедельник" />
      </label>
      <label className="field">Итог
        <select value={outcome} onChange={e => setOutcome(e.target.value as Outcome)}>
          <option value="back">Вернулся в работу</option>
          <option value="pause">Пауза</option>
          <option value="silent">Молчит</option>
          <option value="left">Ушёл</option>
        </select>
      </label>
      <button type="submit">Связался</button>
    </form>
  )
}
