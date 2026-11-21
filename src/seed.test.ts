import { expect, it } from 'vitest'
import { canMove, cardsOf, isOverdue, riskFlags } from './domain'
import { makeSeed } from './seed'

it('демо-сид показывает всё, что нужно увидеть сразу', () => {
  const now = Date.UTC(2026, 10, 21)
  const st = makeSeed(now)
  expect(st.cards.filter(c => isOverdue(c, now)).length).toBeGreaterThanOrEqual(2)
  const kinds = new Set(st.students.flatMap(s => riskFlags(s, st.modules, cardsOf(st, s.id), now).map(f => f.kind)))
  expect([...kinds].sort()).toEqual(['lag', 'rework', 'silent'])
  // на проверке/доработке только домашки, как требуют переходы
  for (const c of st.cards.filter(c => c.column === 'review' || c.column === 'rework')) expect(c.type).toBe('homework')
  expect(canMove(st.cards.find(c => c.column === 'review')!, 'done', 'curator')).toBe(true)
})
