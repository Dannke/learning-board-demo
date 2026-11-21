import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Board } from './Board'
import { CardDialog } from './CardDialog'
import { cardsOf, currentModule, lagDays, moduleDeadlines, nextStep, type Role } from './domain'
import { fmtDate, pad } from './format'
import { Route } from './Route'
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
  const modTitle = (id: string) => state.modules.find(m => m.id === id)?.title ?? id

  const hint = next?.column === 'rework' ? 'Куратор вернул работу: посмотри комментарий и сдай повторно'
    : next?.column === 'progress' ? 'Продолжи то, что уже в работе' : 'Возьми в работу следующую карточку'

  return (
    <div className="view enter">
      <div className="overview">
        <section className="panel route-panel" aria-label="Темп по плану">
          <div className="route-head">
            <h2>{cur ? cur.title : 'Программа пройдена'}</h2>
            {cur && <span className="label mono">модуль {pad(state.modules.indexOf(cur) + 1)} из {pad(state.modules.length)}</span>}
            {!cur ? <span className="chip chip-ok"><span className="dot" />Все модули пройдены</span>
              : lag === 0 ? <span className="chip chip-ok"><span className="dot" />В графике</span>
              : <span className="chip chip-warn mono" title={`Модуль «${cur.title}» по плану был до ${fmtDate(deadlines[cur.id])}`}><span className="dot" />Отставание {lag} дн.</span>}
          </div>
          <Route modules={state.modules} cards={cards} deadlines={deadlines} start={student.start} now={now} lag={lag} />
        </section>

        <section className="panel next-panel" aria-label="Следующий шаг">
          <span className="label next-label"><span className="dot" />{role === 'student' ? 'Следующий шаг' : 'Следующий шаг ученика'}</span>
          {next ? <>
            {role === 'student' && <p className="next-hint">{hint}</p>}
            <p className="next-title">{next.title}</p>
            <p className="next-meta">{modTitle(next.moduleId)} · {next.points} SP · {next.type === 'extra' ? 'без срока' : `срок ${fmtDate(deadlines[next.moduleId])}`}</p>
            <button className="btn btn-primary btn-lg" onClick={() => setOpenId(next.id)}>Открыть задание <ArrowRight size={16} strokeWidth={1.5} /></button>
          </> : <p className="next-hint">{waiting ? 'Все текущие задания на проверке, ждём куратора' : 'Все обязательные задания сделаны'}</p>}
        </section>
      </div>

      <Board cards={cards} modules={state.modules} deadlines={deadlines} now={now} onOpen={c => setOpenId(c.id)} />

      {open && (
        <CardDialog key={open.id} card={open} role={role} state={state} now={now} deadline={deadlines[open.moduleId]}
          onMove={(to, o) => app.moveCard(open.id, to, role, o)} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}
