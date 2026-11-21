import { Ellipsis, Moon, RotateCcw, Sun } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { CuratorView } from './CuratorView'
import type { Role } from './domain'
import { initials } from './format'
import { useApp, vt } from './store'
import { StudentView } from './StudentView'

type Theme = 'light' | 'dark'

export default function App() {
  const app = useApp()
  const [role, setRole] = useState<Role>('student')
  const [studentId, setStudentId] = useState(app.state.students[0].id)
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  const [confirmReset, setConfirmReset] = useState(false)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    vt(() => { document.documentElement.dataset.theme = next; setTheme(next) })
    try { localStorage.setItem('theme', next) } catch { /* без хранилища тема живёт до перезагрузки */ }
  }
  const student = app.state.students.find(s => s.id === studentId)!

  return (
    <>
      <header className="top">
        <div className="brand">
          <Mark />
          Учебная платформа
          <span className="demo-tag" title="Ученики и задания вымышленные, данные хранятся только в этом браузере">демо</span>
        </div>
        <fieldset className="seg" style={{ '--i': role === 'student' ? 0 : 1 } as CSSProperties}>
          <legend className="sr-only">Роль</legend>
          <span className="seg-thumb" aria-hidden="true" />
          {(['student', 'curator'] as const).map(r => (
            <label key={r} className={role === r ? 'is-on' : ''}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => vt(() => setRole(r))} />
              {r === 'student' ? 'Ученик' : 'Куратор'}
            </label>
          ))}
        </fieldset>
        {role === 'student' && (
          <label className="picker">
            <span className="avatar" aria-hidden="true">{initials(student.name)}</span>
            <span className="sr-only">Ученик</span>
            <select value={studentId} onChange={e => setStudentId(e.target.value)}>
              {app.state.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <div className="top-actions">
          <button className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>
          <button className="icon-btn" popoverTarget="menu" aria-label="Меню" title="Меню" onClick={() => setConfirmReset(false)}>
            <Ellipsis size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div id="menu" popover="auto" className="menu">
          <p>Ученики и задания вымышленные, данные хранятся только в этом браузере. Роль переключается вверху, без входа</p>
          <hr />
          {confirmReset ? (
            <div className="menu-confirm">
              <button className="btn btn-danger" popoverTarget="menu" popoverTargetAction="hide" onClick={() => { app.reset(); setConfirmReset(false) }}>Сбросить</button>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Отмена</button>
            </div>
          ) : (
            <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}><RotateCcw size={16} strokeWidth={1.5} />Сбросить демо-данные</button>
          )}
        </div>
      </header>
      <main className="main">
        {role === 'student' ? <StudentView key={studentId} app={app} studentId={studentId} role="student" /> : <CuratorView app={app} />}
      </main>
    </>
  )
}

/** Знак: станция на линии — та же деталь, что в линии курса. */
function Mark() {
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" stroke="var(--text)" strokeWidth="2" />
      <circle cx="5" cy="6" r="3.5" fill="var(--accent)" />
      <circle cx="19" cy="6" r="3" fill="var(--surface)" stroke="var(--text)" strokeWidth="2" />
    </svg>
  )
}
