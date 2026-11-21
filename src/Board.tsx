import { COLUMNS, isOverdue, reviewWaitMs, type Card, type Module } from './domain'
import { fmtDate, fmtDur, TYPE_LABEL } from './format'

interface Props {
  cards: Card[]; modules: Module[]; deadlines: Record<string, number>; now: number; onOpen: (c: Card) => void
}

export function Board({ cards, modules, deadlines, now, onOpen }: Props) {
  const title = (id: string) => modules.find(m => m.id === id)?.title ?? id
  return (
    <div className="board" role="list" aria-label="Доска заданий">
      {COLUMNS.map(col => {
        const list = cards.filter(c => c.column === col.id)
        return (
          <section key={col.id} className={`col col-${col.id}`} role="listitem" aria-label={col.title}>
            <h3 className="col-title">{col.title} <span className="count">{list.length}</span></h3>
            <ul className="cards">
              {list.map(c => {
                const wait = reviewWaitMs(c, now)
                const late = c.column !== 'done' && c.type !== 'extra' && now > deadlines[c.moduleId]
                const comments = c.history.filter(e => e.comment).length
                return (
                  <li key={c.id}>
                    <button className={`tile mod-${c.moduleId}`} onClick={() => onOpen(c)}>
                      <span className={`tag tag-${c.type}`}>{TYPE_LABEL[c.type]}</span>
                      <span className="tile-title">{c.title}</span>
                      <span className="tile-meta">
                        <span className="mod-label">{title(c.moduleId)}</span>
                        <span title="Story Points">{c.points} SP</span>
                        {c.column !== 'done' && c.type !== 'extra' && (
                          <span className={late ? 'late' : ''}>{late ? 'срок прошёл ' : 'до '}{fmtDate(deadlines[c.moduleId])}</span>
                        )}
                        {comments > 0 && <span>комм.: {comments}</span>}
                      </span>
                      {wait !== null && (
                        <span className={`wait ${isOverdue(c, now) ? 'wait-over' : ''}`}>
                          {isOverdue(c, now) ? 'Ждёт проверки > 24 ч: ' : 'Ждёт проверки: '}{fmtDur(wait)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
