import { expect, it } from 'vitest'

let count1 = 0
it('retry test', () => {
  count1 += 1
  expect(count1).toBe(3)
}, { retry: 3 })

let count2 = 0
it.fails('retry test fails', () => {
  count2 += 1
  expect(count2).toBe(3)
}, { retry: 2 })

it('result', () => {
  expect(count1).toEqual(3)
  expect(count2).toEqual(2)
})
