import { useState } from 'react'
import { CuratorView } from './CuratorView'
import type { Role } from './domain'
import { useApp } from './store'
import { StudentView } from './StudentView'

export default function App() {
  const app = useApp()
  const [role, setRole] = useState<Role>('student')
  const [studentId, setStudentId] = useState(app.state.students[0].id)

  return (
    <>
      <header className="top">
        <h1>Учебная платформа <span className="muted">демо</span></h1>
        <fieldset className="roles">
          <legend className="sr-only">Роль</legend>
          {(['student', 'curator'] as const).map(r => (
            <label key={r} className={role === r ? 'seg is-on' : 'seg'}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
              {r === 'student' ? 'Ученик' : 'Куратор'}
            </label>
          ))}
        </fieldset>
        {role === 'student' && (
          <label className="pick">Ученик
            <select value={studentId} onChange={e => setStudentId(e.target.value)}>
              {app.state.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <button className="ghost" onClick={() => { if (confirm('Вернуть демо-данные к исходным?')) app.reset() }}>Сбросить демо</button>
      </header>
      <p className="demo-note">Демо: ученики и задания вымышленные, данные хранятся только в этом браузере. Роль переключается вверху, без входа.</p>
      <main className="main">
        {role === 'student' ? <StudentView key={studentId} app={app} studentId={studentId} role="student" /> : <CuratorView app={app} />}
      </main>
    </>
  )
}
