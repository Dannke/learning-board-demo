import { useState } from 'react'
import { Board } from './Board'
import { CardDialog } from './CardDialog'
import { cardsOf, currentModule, lagDays, moduleDeadlines, nextStep, type Role } from './domain'
import { fmtDate } from './format'
import type { App } from './store'

export function StudentView({ app, studentId, role }: { app: App; studentId: string; role: Role }) {
  const { state, now } = app
  const [openId, setOpenId] = useState<string | null>(null)
  const student = state.students.find(s => s.id === studentId)!
  const cards = cardsOf(state, studentId)
  const deadlines = moduleDeadlines(state.modules, student.start)
  const cur = currentModule(state.modules, cards)
  const lag = lagDays(student, state.modules, cards, now)
  const next = nextStep(state.modules, cards)
  const open = cards.find(c => c.id === openId)
  const waiting = cards.some(c => c.column === 'review')

  const hint = next?.column === 'rework' ? 'Куратор вернул работу — посмотри комментарий и сдай повторно'
    : next?.column === 'progress' ? 'Продолжи то, что уже в работе' : 'Возьми в работу следующую карточку'

  return (
    <>
      <section className="pace" aria-label="Темп по плану">
        <ol className="modules">
          {state.modules.map(m => {
            const done = cur ? state.modules.indexOf(m) < state.modules.indexOf(cur) : true
            const isCur = m.id === cur?.id
            const total = cards.filter(c => c.moduleId === m.id && c.type !== 'extra')
            const ok = total.filter(c => c.column === 'done').length
            return (
              <li key={m.id} className={`mod mod-${m.id} ${done ? 'is-done' : ''} ${isCur ? 'is-cur' : ''}`} aria-current={isCur ? 'step' : undefined}>
                <span className="mod-name">{m.title}</span>
                <span className="mod-sub">{done ? 'пройден' : `${ok}/${total.length} · до ${fmtDate(deadlines[m.id])}`}</span>
              </li>
            )
          })}
        </ol>
        <div className="pace-row">
          {!cur ? <p className="badge badge-ok">Программа пройдена</p>
            : lag === 0 ? <p className="badge badge-ok">В графике: «{cur.title}» по плану до {fmtDate(deadlines[cur.id])}</p>
            : <p className="badge badge-warn">Отставание от плана: {lag} дн. Модуль «{cur.title}» по плану был до {fmtDate(deadlines[cur.id])}</p>}
        </div>
      </section>

      <section className="next" aria-label="Следующий шаг">
        <h2>Следующий шаг</h2>
        {next ? (
          <p>{role === 'student' ? hint : 'Следующий шаг ученика'}: <button className="link" onClick={() => setOpenId(next.id)}>{next.title}</button></p>
        ) : <p>{waiting ? 'Все текущие задания на проверке — ждём куратора.' : 'Все обязательные задания сделаны.'}</p>}
      </section>

      <Board cards={cards} modules={state.modules} deadlines={deadlines} now={now} onOpen={c => setOpenId(c.id)} />

      {open && (
        <CardDialog key={open.id} card={open} role={role} state={state} now={now} deadline={deadlines[open.moduleId]}
          onMove={(to, o) => app.moveCard(open.id, to, role, o)} onClose={() => setOpenId(null)} />
      )}
    </>
  )
}
