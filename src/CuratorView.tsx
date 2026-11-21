import { ArrowLeft, ArrowRight, Clock, TrendingDown, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { CardDialog } from './CardDialog'
import {
  cardsOf, currentModule, isOverdue, lagDays, lastStudentActivity, median, moduleDeadlines, REVIEW_SLA, reviewWaitMs, riskFlags,
  type Card, type Flag, type Outcome, type Student,
} from './domain'
import { fmtDate, fmtDur, initials, STATUS_LABEL } from './format'
import { RouteMini } from './Route'
import { vt, type App } from './store'
import { StudentView } from './StudentView'

type Tab = 'review' | 'risk' | 'students'
const ico = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const

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
  const goBoard = (id: string | null) => vt(() => setBoard(id))

  if (board) return (
    <div className="view enter">
      <div className="board-head">
        <button className="btn btn-ghost" onClick={() => goBoard(null)}><ArrowLeft {...ico} />К списку</button>
        <h2>Доска ученика · {name(board)}</h2>
      </div>
      <StudentView app={app} studentId={board} role="curator" />
    </div>
  )

  const queueTable = (rows: { c: Card; wait: number }[]) => (
    <div className="table-wrap"><table className="table queue">
      <thead><tr><th>Ученик</th><th>Задание</th><th>Модуль</th><th>Ждёт</th><th><span className="sr-only">Шкала 24 часа</span></th><th /></tr></thead>
      <tbody>{rows.map(({ c, wait }) => (
        <tr key={c.id} className="row-click" onClick={() => setOpenId(c.id)}>
          <td><span className="cell-person"><span className="avatar" aria-hidden="true">{initials(name(c.studentId))}</span>{name(c.studentId)}</span></td>
          <td>{c.title}</td>
          <td className="cell-sub">{modTitle(c.moduleId)}</td>
          <td className={`wait-big ${isOverdue(c, now) ? 'late' : ''}`}>{fmtDur(wait)}</td>
          <td><Sla wait={wait} /></td>
          <td className="td-end"><button className="btn btn-secondary" onClick={e => { e.stopPropagation(); setOpenId(c.id) }}>Проверить<ArrowRight {...ico} /></button></td>
        </tr>
      ))}</tbody>
    </table></div>
  )

  const tabs: [Tab, string, number?][] = [['review', 'Проверка', queue.length], ['risk', 'На грани ухода', risky.length], ['students', 'Ученики']]
  return (
    <div className="view">
      <nav className="tabs" role="tablist" aria-label="Разделы куратора">
        {tabs.map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
            {label}{n !== undefined && <span className="tab-count">{n}</span>}
          </button>
        ))}
      </nav>

      {tab === 'review' && <section key="review" className="view enter" aria-label="Очередь проверки">
        <div className="stats">
          <Stat label="Ждут проверки" value={String(queue.length)} />
          <Stat label="Дольше 24 ч" value={String(over.length)} late={over.length > 0} />
          <Stat label="Медиана ожидания" value={med === null ? '—' : fmtDur(med)} />
        </div>
        <div className="section">
          <h2 className="section-head"><span className="dot" style={{ background: 'var(--danger)' }} />Ждут дольше 24 часов</h2>
          {over.length ? queueTable(over) : <p className="empty">Таких нет</p>}
        </div>
        <div className="section">
          <h2 className="section-head"><span className="dot" />Остальные в очереди</h2>
          {queue.length > over.length ? queueTable(queue.filter(q => !isOverdue(q.c, now))) : <p className="empty">Очередь пуста</p>}
        </div>
      </section>}

      {tab === 'risk' && <section key="risk" className="view enter" aria-label="На грани ухода">
        <p className="intro">Не двигали карточки 5+ дней, не реагируют на доработку 3+ дня или отстают от плана на 7+ дней. Свяжитесь и отметьте итог: ученик скроется из списка на 3 дня, а статус «пауза / молчит / ушёл» сохранится с датой и модулем.</p>
        {risky.length === 0 ? <p className="empty">Сейчас никого</p> : (
          <ul className="risk-grid">{risky.map(({ s, flags }) => (
            <RiskCard key={s.id} s={s} flags={flags} module={modTitle(currentModule(state.modules, cardsOf(state, s.id))?.id)}
              cards={state.cards} onBoard={() => goBoard(s.id)} onSave={(n, o) => app.contact(s.id, n, o)} />
          ))}</ul>
        )}
      </section>}

      {tab === 'students' && <section key="students" className="view enter" aria-label="Ученики">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Ученик</th><th>Старт</th><th>Модуль</th><th>Темп</th><th>Последнее действие</th><th>Статус</th><th /></tr></thead>
          <tbody>{state.students.map(s => <StudentRow key={s.id} s={s} app={app} onBoard={() => goBoard(s.id)} />)}</tbody>
        </table></div>
      </section>}

      {open && (
        <CardDialog key={open.id} card={open} role="curator" state={state} now={now}
          deadline={moduleDeadlines(state.modules, state.students.find(s => s.id === open.studentId)!.start)[open.moduleId]}
          onMove={(to, o) => app.moveCard(open.id, to, 'curator', o)} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}

function Stat({ label, value, late }: { label: string; value: string; late?: boolean }) {
  return <div className="panel stat"><span className="label">{label}</span><span className={`stat-value ${late ? 'late' : ''}`}>{value}</span></div>
}

/** Шкала ожидания: риска — 24 ч, правее риски — красным. Шкала до 72 ч. */
function Sla({ wait }: { wait: number }) {
  const W = 120, max = 3 * REVIEW_SLA, x = (ms: number) => (Math.min(ms, max) / max) * W, tick = x(REVIEW_SLA)
  return (
    <svg className="sla" viewBox={`0 0 ${W} 12`} aria-hidden="true">
      <rect className="sla-track" x="0" y="4" width={W} height="4" rx="2" />
      <rect className="sla-ok" x="0" y="4" width={Math.min(x(wait), tick)} height="4" rx="2" />
      {wait > REVIEW_SLA && <rect className="sla-over" x={tick} y="4" width={x(wait) - tick} height="4" rx="2" />}
      <line className="sla-tick" x1={tick} y1="0" x2={tick} y2="12" strokeWidth="1.5" />
    </svg>
  )
}

const FLAG_ICON = { silent: Clock, rework: Undo2, lag: TrendingDown }
function flagText(f: Flag, cards: Card[]) {
  if (f.kind === 'silent') return `Не двигал карточки ${f.days} дн.`
  if (f.kind === 'lag') return `Отстаёт от плана на ${f.days} дн.`
  return `Доработка без реакции ${f.days} дн.: «${cards.find(c => c.id === f.cardId)?.title}»`
}

function RiskCard({ s, flags, module, cards, onBoard, onSave }: {
  s: Student; flags: Flag[]; module: string; cards: Card[]; onBoard: () => void; onSave: (note: string, o: Outcome) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <li className="panel risk">
      <div className="risk-head">
        <span className="avatar" aria-hidden="true">{initials(s.name)}</span>
        <div><div className="risk-name">{s.name}</div><div className="label">модуль «{module}»</div></div>
        <button className="btn btn-ghost" onClick={onBoard}>Доска<ArrowRight {...ico} /></button>
      </div>
      <ul className="flags">{flags.map((f, i) => {
        const I = FLAG_ICON[f.kind]
        return <li key={i} className="flag"><I {...ico} />{flagText(f, cards)}</li>
      })}</ul>
      {!open && <button className="btn btn-secondary" style={{ justifySelf: 'start' }} onClick={() => setOpen(true)} aria-expanded={false}>Отметить контакт</button>}
      <div className={`disclosure ${open ? 'is-open' : ''}`}><div>
        {open && <ContactForm onSave={onSave} onCancel={() => setOpen(false)} />}
      </div></div>
    </li>
  )
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
      <td><span className="cell-person"><span className="avatar" aria-hidden="true">{initials(s.name)}</span>{s.name}</span></td>
      <td className="mono cell-sub">{fmtDate(s.start)}</td>
      <td>{cur?.title ?? 'пройдено'}</td>
      <td><span className="pace-cell">
        <RouteMini modules={state.modules} cards={cards} lag={lag} />
        <span className={`mono ${lag >= 7 ? 'late' : 'cell-sub'}`} style={{ fontSize: 12 }}>{lag ? `−${lag} дн.` : 'в графике'}</span>
      </span></td>
      <td className="cell-sub">{fmtDur(now - lastStudentActivity(s, cards))} назад</td>
      <td>
        <span className={`status status-${s.status}`}><span className="dot" />{STATUS_LABEL[s.status]}</span>
        {s.status !== 'active' && s.statusAt && <div className="label">с {fmtDate(s.statusAt)}, {mod(s.statusModule) ?? '—'}</div>}
        {edit && <ContactForm onSave={(n, o) => { app.contact(s.id, n, o); setEdit(false) }} onCancel={() => setEdit(false)} />}
      </td>
      <td className="td-end">
        <button className="btn btn-ghost" onClick={onBoard}>Доска</button>
        {!edit && <button className="btn btn-ghost" onClick={() => setEdit(true)}>Связался</button>}
      </td>
    </tr>
  )
}

function ContactForm({ onSave, onCancel }: { onSave: (note: string, o: Outcome) => void; onCancel: () => void }) {
  const [note, setNote] = useState('')
  const [outcome, setOutcome] = useState<Outcome>('back')
  return (
    <form className="contact" onSubmit={e => { e.preventDefault(); onSave(note.trim(), outcome) }}>
      <label className="field">Что узнали
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Завал на работе, вернётся в понедельник" autoFocus />
      </label>
      <label className="field">Итог
        <select value={outcome} onChange={e => setOutcome(e.target.value as Outcome)}>
          <option value="back">Вернулся в работу</option>
          <option value="pause">Пауза</option>
          <option value="silent">Молчит</option>
          <option value="left">Ушёл</option>
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
        <button type="submit" className="btn btn-primary">Сохранить контакт</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  )
}
