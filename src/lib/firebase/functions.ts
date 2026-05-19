import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'
import { app } from '@/lib/firebase/client'
import { env } from '@/config/env'
const functionsInstance = getFunctions(app, 'asia-south1')
let emulatorsConnected = false
if (env.NEXT_PUBLIC_USE_EMULATOR && typeof window !== 'undefined' && !emulatorsConnected) {
  emulatorsConnected = true
  connectFunctionsEmulator(functionsInstance, 'localhost', 5001)
}
export const createUserFn = httpsCallable<
  { email: string; password: string; displayName: string; role: string; workstationIds?: string[] },
  { uid: string }
>(functionsInstance, 'createUser')
export const setUserRoleFn = httpsCallable<{ targetUid: string; role: string }, { success: boolean }>(functionsInstance, 'setUserRole')
export const deleteUserFn = httpsCallable<{ targetUid: string }, { success: boolean }>(functionsInstance, 'deleteUser')
export const deleteWorkstationFn = httpsCallable<{ wsId: string }, { success: boolean }>(functionsInstance, 'deleteWorkstation')
