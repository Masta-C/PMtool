import { getApps, initializeApp } from 'firebase-admin/app'
export function initAdminApp() {
  if (getApps().length > 0) return
  initializeApp({ projectId: 'pmtool-3f8db' })
}
