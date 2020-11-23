import { withdefault } from '../src/utils'

test('default', () => {
  expect(withdefault(1, 2)).toBe(2)
  expect(withdefault(1, undefined)).toBe(1)
})
