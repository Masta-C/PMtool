export type Role = 'admin' | 'supervisor' | 'operator' | 'qa'
export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: Role
  workstationIds: string[]
  shiftId: string | null
  isActive: boolean
  createdAt: unknown
  createdBy?: string
}
