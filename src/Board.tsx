import { BookOpen, CircleDashed, CirclePlus, Clock, Code, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { COLUMNS, isOverdue, reviewWaitMs, type Card, type CardType, type Module } from './domain'
import { fmtDate, fmtDur, TYPE_LABEL } from './format'

const ICON = { theory: BookOpen, homework: Code, info: CircleDashed, extra: CirclePlus }
export function TypeIcon({ type }: { type: CardType }) {
  const I = ICON[type]
  return <I size={14} strokeWidth={1.5} aria-hidden="true" />
}

interface Props {
  cards: Card[]; modules: Module[]; deadlines: Record<string, number>; now: number; onOpen: (c: Card) => void
}

export function Board({ cards, modules, deadlines, now, onOpen }: Props) {
  const [showDone, setShowDone] = useState(false)
  const title = (id: string) => modules.find(m => m.id === id)?.title ?? id
  return (
    <div className="board" role="list" aria-label="Доска заданий">
      {COLUMNS.map(col => {
        const all = cards.filter(c => c.column === col.id)
        const collapsed = col.id === 'done' && !showDone
        const list = collapsed ? [] : all
        return (
          <section key={col.id} className={`col col-${col.id}`} role="listitem" aria-label={col.title}>
            <h3 className="col-head">{col.id !== 'backlog' && <span className="dot" />}{col.title}<span className="col-count">{all.length}</span></h3>
            {list.length > 0 && <ul className="cards">
              {list.map(c => {
                const wait = reviewWaitMs(c, now)
                const dated = c.column !== 'done' && c.type !== 'extra'
                const late = dated && now > deadlines[c.moduleId]
                const comments = c.history.filter(e => e.comment).length
                return (
                  <li key={c.id}>
                    <button className="tile" style={{ viewTransitionName: `card-${c.id}` }} onClick={() => onOpen(c)}>
                      <span className="tile-type"><TypeIcon type={c.type} />{TYPE_LABEL[c.type]}</span>
                      <span className="tile-title">{c.title}</span>
                      <span className="tile-meta">
                        <span>{title(c.moduleId)}</span>
                        <span title="Story Points">{c.points} SP</span>
                        {dated && <span className={late ? 'late' : ''}>{late ? 'срок прошёл ' : 'до '}{fmtDate(deadlines[c.moduleId])}</span>}
                        {comments > 0 && <span title="Комментарии"><MessageSquare size={12} strokeWidth={1.5} aria-hidden="true" />{comments}</span>}
                      </span>
                      {wait !== null && (
                        <span className={`wait ${isOverdue(c, now) ? 'wait-over' : ''}`}>
                          <Clock size={14} strokeWidth={1.5} aria-hidden="true" />ждёт проверки {fmtDur(wait)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>}
            {col.id === 'done' && all.length > 0 && (
              <button className="btn btn-ghost col-toggle" onClick={() => setShowDone(v => !v)} aria-expanded={showDone}>
                {showDone ? 'Свернуть' : `Показать ${all.length}`}
              </button>
            )}
            {all.length === 0 && <p className="empty">Пусто</p>}
          </section>
        )
      })}
    </div>
  )
}
