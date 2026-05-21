import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app'

export function initAdminApp() {
  if (getApps().length > 0) return
  initializeApp({
    credential: applicationDefault(),
    projectId: 'pmtool-3f8db',
  })
}
