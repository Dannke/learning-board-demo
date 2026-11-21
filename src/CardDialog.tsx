import { Check, CircleAlert, Clock, ExternalLink, MessageSquare, Play, Send, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { TypeIcon } from './Board'
import { COLUMNS, isOverdue, reviewWaitMs, type Card, type Column, type Role, type State } from './domain'
import { fmtDate, fmtDur, TYPE_LABEL } from './format'

interface Props {
  card: Card; role: Role; state: State; now: number; deadline: number
  onMove: (to: Column, o: { comment?: string; link?: string }) => void
  onClose: () => void
}

const colTitle = (c: Column) => COLUMNS.find(x => x.id === c)!.title
const ico = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const

export function CardDialog({ card, role, state, now, deadline, onMove, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const lastLink = card.history.findLast(e => e.link)?.link ?? ''
  const [link, setLink] = useState(lastLink)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { ref.current?.showModal() }, [])

  const student = state.students.find(s => s.id === card.studentId)!
  const module = state.modules.find(m => m.id === card.moduleId)!
  const wait = reviewWaitMs(card, now)
  const lastCuratorNote = card.column === 'rework' ? card.history.findLast(e => e.by === 'curator' && e.comment) : undefined

  const act = (to: Column, o: { comment?: string; link?: string } = {}) => {
    try { onMove(to, o); onClose() } catch (e) { setError((e as Error).message) }
  }
  const linkField = (
    <label className="field">Ссылка на решение
      <input type="url" value={link} onChange={e => { setLink(e.target.value); setError('') }} placeholder="https://colab.research.google.com/…" />
    </label>
  )
  const s = role === 'student', c = card.column, hw = card.type === 'homework'
  const hasActions = s ? c === 'backlog' || c === 'progress' || c === 'rework' : c === 'review'

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="card-title"
      onClick={e => { if (e.target === e.currentTarget) ref.current?.close() }}>
      <header className="sheet-head">
        <span className="tile-type"><TypeIcon type={card.type} />{TYPE_LABEL[card.type]}</span>
        <h2 id="card-title">{card.title}</h2>
        <button className="icon-btn" onClick={() => ref.current?.close()} aria-label="Закрыть"><X size={18} strokeWidth={1.5} /></button>
      </header>

      <div className="sheet-body">
        <dl className="meta">
          <div><dt>Ученик</dt><dd>{student.name}</dd></div>
          <div><dt>Модуль</dt><dd>{module.title}</dd></div>
          <div><dt>Колонка</dt><dd>{colTitle(c)}</dd></div>
          <div><dt>Срок по плану</dt><dd className="mono">{card.type === 'extra' ? 'без срока' : fmtDate(deadline)}</dd></div>
          <div><dt>Объём</dt><dd className="mono">{card.points} SP</dd></div>
        </dl>
        {card.description && <p>{card.description}</p>}

        {lastCuratorNote && <p className="note"><MessageSquare {...ico} /><span>Комментарий куратора: {lastCuratorNote.comment}</span></p>}
        {wait !== null && (
          <p className={isOverdue(card, now) ? 'note note-danger' : 'note'}><Clock {...ico} />
            <span>Ждёт проверки <span className="mono">{fmtDur(wait)}</span>{isOverdue(card, now) && ', дольше 24 часов'}</span>
          </p>
        )}
        {!s && c === 'review' && lastLink && (
          <p className="solution"><ExternalLink {...ico} />Решение: <a href={lastLink} target="_blank" rel="noreferrer">{lastLink}</a></p>
        )}

        <section>
          <h3 style={{ marginBottom: 12 }}>История</h3>
          {card.history.length === 0 ? <p className="muted">Пока без движения</p> : (
            <ol className="timeline">
              {[...card.history].reverse().map((e, i) => (
                <li key={i} className="tl-item">
                  <span className="tl-time">{fmtDate(e.at)}, {new Date(e.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{e.by === 'student' ? 'Ученик' : 'Куратор'}: {colTitle(e.from)} → {colTitle(e.to)}
                    {e.link && <> · <a href={e.link} target="_blank" rel="noreferrer">решение</a></>}</span>
                  {e.comment && <blockquote>{e.comment}</blockquote>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {hasActions && (
        <footer className="sheet-foot">
          {s && (c === 'progress' && hw || c === 'rework') && linkField}
          {!s && c === 'review' && (
            <label className="field">Комментарий ученику
              <textarea rows={3} value={comment} onChange={e => { setComment(e.target.value); setError('') }} placeholder="Обязателен при возврате на доработку" />
            </label>
          )}
          {error && <p className="error" role="alert"><CircleAlert {...ico} />{error}</p>}
          <div className="row">
            {s && c === 'backlog' && <button className="btn btn-primary btn-lg" onClick={() => act('progress')}><Play {...ico} />Взять в работу</button>}
            {s && c === 'progress' && hw && <button className="btn btn-primary btn-lg" onClick={() => act('review', { link })}><Send {...ico} />Сдать на проверку</button>}
            {s && c === 'progress' && !hw && <button className="btn btn-primary btn-lg" onClick={() => act('done')}><Check {...ico} />Готово</button>}
            {s && c === 'progress' && <button className="btn btn-ghost btn-lg" onClick={() => act('backlog')}><Undo2 {...ico} />Вернуть в бэклог</button>}
            {s && c === 'rework' && <button className="btn btn-primary btn-lg" onClick={() => act('review', { link })}><Send {...ico} />Сдать повторно</button>}
            {!s && c === 'review' && <>
              <button className="btn btn-primary btn-lg" onClick={() => act('done', { comment })}><Check {...ico} />Принять</button>
              <button className="btn btn-secondary btn-lg" onClick={() => act('rework', { comment })}><Undo2 {...ico} />Вернуть на доработку</button>
            </>}
          </div>
        </footer>
      )}
    </dialog>
  )
}
