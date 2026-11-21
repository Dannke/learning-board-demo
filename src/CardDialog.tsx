import { useEffect, useRef, useState } from 'react'
import { COLUMNS, isOverdue, reviewWaitMs, type Card, type Column, type Role, type State } from './domain'
import { fmtDate, fmtDur, TYPE_LABEL } from './format'

interface Props {
  card: Card; role: Role; state: State; now: number; deadline: number
  onMove: (to: Column, o: { comment?: string; link?: string }) => void
  onClose: () => void
}

const colTitle = (c: Column) => COLUMNS.find(x => x.id === c)!.title

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
      <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" />
    </label>
  )

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="card-title">
      <header className="dialog-head">
        <span className={`tag tag-${card.type}`}>{TYPE_LABEL[card.type]}</span>
        <h2 id="card-title">{card.title}</h2>
        <button className="ghost close" onClick={() => ref.current?.close()} aria-label="Закрыть">✕</button>
      </header>
      <dl className="meta">
        <div><dt>Ученик</dt><dd>{student.name}</dd></div>
        <div><dt>Модуль</dt><dd>{module.title}</dd></div>
        <div><dt>Колонка</dt><dd>{colTitle(card.column)}</dd></div>
        <div><dt>Срок по плану</dt><dd>{card.type === 'extra' ? 'без срока' : fmtDate(deadline)}</dd></div>
        <div><dt>Объём</dt><dd>{card.points} SP</dd></div>
      </dl>
      {card.description && <p>{card.description}</p>}

      {lastCuratorNote && <p className="note">Комментарий куратора: {lastCuratorNote.comment}</p>}
      {wait !== null && (
        <p className={isOverdue(card, now) ? 'note note-danger' : 'note'}>Ждёт проверки {fmtDur(wait)}{isOverdue(card, now) && ' — дольше 24 часов'}</p>
      )}

      <div className="actions">
        {role === 'student' && card.column === 'backlog' && <button onClick={() => act('progress')}>Взять в работу</button>}
        {role === 'student' && card.column === 'progress' && card.type === 'homework' && <>
          {linkField}
          <button onClick={() => act('review', { link })}>Сдать на проверку</button>
        </>}
        {role === 'student' && card.column === 'progress' && card.type !== 'homework' && <button onClick={() => act('done')}>Готово</button>}
        {role === 'student' && card.column === 'progress' && <button className="ghost" onClick={() => act('backlog')}>Вернуть в бэклог</button>}
        {role === 'student' && card.column === 'rework' && <>
          {linkField}
          <button onClick={() => act('review', { link })}>Сдать повторно</button>
        </>}
        {role === 'curator' && card.column === 'review' && <>
          {lastLink && <p>Решение: <a href={lastLink} target="_blank" rel="noreferrer">{lastLink}</a></p>}
          <label className="field">Комментарий ученику
            <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Обязателен при возврате" />
          </label>
          <button onClick={() => act('done', { comment })}>Принять</button>
          <button className="secondary" onClick={() => act('rework', { comment })}>Вернуть на доработку</button>
        </>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>

      <h3>История</h3>
      {card.history.length === 0 ? <p className="muted">Пока без движения.</p> : (
        <ol className="history">
          {[...card.history].reverse().map((e, i) => (
            <li key={i}>
              <span className="muted">{fmtDate(e.at)}, {new Date(e.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>{' '}
              {e.by === 'student' ? 'Ученик' : 'Куратор'}: {colTitle(e.from)} → {colTitle(e.to)}
              {e.link && <> · <a href={e.link} target="_blank" rel="noreferrer">решение</a></>}
              {e.comment && <blockquote>{e.comment}</blockquote>}
            </li>
          ))}
        </ol>
      )}
    </dialog>
  )
}
