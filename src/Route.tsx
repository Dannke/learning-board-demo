import type { CSSProperties } from 'react'
import { currentModule, planPosition, type Card, type Module } from './domain'
import { fmtDate, pad } from './format'

interface Props { modules: Module[]; cards: Card[]; deadlines: Record<string, number>; start: number; now: number; lag: number }

/** Линия курса: модули — станции; залито пройденное, янтарём — отставание до метки «по плану». */
export function Route({ modules, cards, deadlines, start, now, lag }: Props) {
  const n = modules.length
  const cur = currentModule(modules, cards)
  const ci = cur ? modules.indexOf(cur) : n - 1
  const plan = planPosition(modules, start, now)
  const step = 100 / n
  return (
    <div className="route" style={{ '--n': n } as CSSProperties}>
      <span className="route-track" />
      {ci > 0 && <span className="route-fill" style={{ width: `${ci * step}%` }} />}
      {lag > 0 && <>
        <span className="route-lag" style={{ left: `${(ci + 0.5) * step}%`, width: `${(plan - ci) * step}%` }} />
        <span className="route-plan" style={{ left: `${(plan + 0.5) * step}%` }}>по плану</span>
      </>}
      <ol aria-label="Модули курса">
        {modules.map((m, i) => {
          const done = !cur || i < ci
          const isCur = !!cur && i === ci
          const req = cards.filter(c => c.moduleId === m.id && c.type !== 'extra')
          const ok = req.filter(c => c.column === 'done').length
          return (
            <li key={m.id} className={`station ${done ? 'is-done' : ''} ${isCur ? 'is-cur' : ''}`} aria-current={isCur ? 'step' : undefined}>
              <span className="st-dot" />
              <span className="st-num">{pad(i + 1)}</span>
              <span className="st-name">{m.title}</span>
              <span className="st-sub">{done ? 'пройден' : isCur ? `${ok}/${req.length} · до ${fmtDate(deadlines[m.id])}` : `до ${fmtDate(deadlines[m.id])}`}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Мини-маршрут для таблицы: 7 сегментов. */
export function RouteMini({ modules, cards, lag }: { modules: Module[]; cards: Card[]; lag: number }) {
  const cur = currentModule(modules, cards)
  const ci = cur ? modules.indexOf(cur) : modules.length
  return (
    <span className="route-mini" role="img" aria-label={cur ? `Модуль ${ci + 1} из ${modules.length}` : 'Программа пройдена'}>
      {modules.map((m, i) => <span key={m.id} className={i < ci ? 'is-done' : i === ci ? (lag > 0 ? 'is-lag' : 'is-cur') : ''} />)}
    </span>
  )
}
