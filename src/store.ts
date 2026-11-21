import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { addContact, applyMove, type Column, type Outcome, type Role, type State } from './domain'
import { makeSeed } from './seed'

const KEY = 'learning-platform-demo-v1'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* приватный режим или битые данные — начинаем с демо */ }
  return makeSeed()
}

export function useApp() {
  const [state, setState] = useState<State>(load)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* хранилище недоступно — работаем в памяти */ }
  }, [state])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  return {
    state, now,
    /** Бросает Error с понятным текстом, если переход недопустим. */
    moveCard(cardId: string, to: Column, by: Role, o: { comment?: string; link?: string }) {
      const t = Date.now()
      const next = applyMove(state, cardId, to, by, t, o) // бросает до setState, чтобы диалог показал ошибку
      vt(() => { setNow(t); setState(next) })
    },
    contact(studentId: string, note: string, outcome: Outcome) {
      const t = Date.now()
      setNow(t)
      setState(s => addContact(s, studentId, { note, outcome }, t))
    },
    reset() {
      const t = Date.now()
      setNow(t)
      setState(makeSeed(t))
    },
  }
}
export type App = ReturnType<typeof useApp>

/** Обновление через View Transitions: карточка переезжает в новую колонку, тема перетекает. Без поддержки — мгновенно. */
export function vt(update: () => void) {
  if (typeof document.startViewTransition !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return update()
  document.startViewTransition(() => flushSync(update))
}
