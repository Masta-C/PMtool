import { ROLES, ORDER_STATUS, WS_COUNT } from '@/lib/constants'

describe('constants', () => {
  it('has all 5 roles', () => expect(Object.keys(ROLES).length).toBe(5))
  it('has 8 order statuses', () => expect(Object.keys(ORDER_STATUS).length).toBe(8))
  it('has 13 workstations', () => expect(WS_COUNT).toBe(13))
})
