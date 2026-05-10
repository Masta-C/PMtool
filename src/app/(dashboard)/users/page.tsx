'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createUserFn, setUserRoleFn, deleteUserFn } from '@/lib/firebase/functions'
import type { Role, AppUser } from '@/types/user'
const ROLES: Role[] = ['super_admin', 'admin', 'supervisor', 'operator', 'qa']
const ROLE_BADGE: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700', admin: 'bg-blue-100 text-blue-700',
  supervisor: 'bg-blue-100 text-blue-700', operator: 'bg-green-100 text-green-700', qa: 'bg-orange-100 text-orange-700',
}
interface UserFormData { displayName: string; email: string; password: string; role: Role; workstationIds: string }
const EMPTY_FORM: UserFormData = { displayName: '', email: '', password: '', role: 'operator', workstationIds: '' }
export default function UsersPage() {
  const { user: currentUser, role: currentRole } = useAuth()
  const { users, loading } = useUsers()
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  function openCreate() { setEditUser(null); setForm(EMPTY_FORM); setFormError(null); setShowForm(true) }
  function openEdit(u: AppUser) { setEditUser(u); setForm({ displayName: u.displayName, email: u.email, password: '', role: u.role, workstationIds: u.workstationIds.join(', ') }); setFormError(null); setShowForm(true) }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setFormError(null)
    try {
      const wsIds = form.workstationIds.split(',').map(s => s.trim()).filter(Boolean)
      if (editUser) { await setUserRoleFn({ targetUid: editUser.uid, role: form.role }) }
      else { await createUserFn({ email: form.email, password: form.password, displayName: form.displayName, role: form.role, workstationIds: wsIds }) }
      setShowForm(false)
    } catch (err: unknown) { setFormError((err as { message?: string }).message ?? 'Failed. Please try again.') }
    finally { setSubmitting(false) }
  }
  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try { await deleteUserFn({ targetUid: deleteTarget.uid }); setDeleteTarget(null) }
    catch (err: unknown) { alert((err as { message?: string }).message ?? 'Delete failed.') }
    finally { setDeleting(false) }
  }
  const needsWorkstations = form.role === 'operator' || form.role === 'qa'
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Users</h1><p className="text-sm text-gray-500 mt-1">{users.length} accounts</p></div>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">+ New User</button>
      </div>
      {loading ? <p className="text-gray-400 text-sm">Loading users...</p> : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name','Email','Role','Workstations','Actions'].map(h => <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.uid} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.displayName}{u.uid === currentUser?.uid && <span className="ml-2 text-xs text-gray-400">(You)</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role]}`}>{u.role.replace('_',' ')}</span></td>
                  <td className="px-4 py-3 text-gray-600">{u.workstationIds?.join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                      {currentRole === 'super_admin' && u.uid !== currentUser?.uid && <button onClick={() => setDeleteTarget(u)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{editUser ? 'Edit User' : 'New User'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editUser && (<>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input required value={form.displayName} onChange={e => setForm(f => ({...f, displayName: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="text" required minLength={6} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min 6 characters" /></div>
              </>)}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value as Role}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROLES.filter(r => currentRole === 'super_admin' || r !== 'super_admin').map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                </select>
              </div>
              {needsWorkstations && <div><label className="block text-sm font-medium text-gray-700 mb-1">Assigned Workstations</label><input value={form.workstationIds} onChange={e => setForm(f => ({...f, workstationIds: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="ws_01, ws_02" /><p className="text-xs text-gray-400 mt-1">Comma-separated workstation IDs</p></div>}
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">{submitting ? 'Saving...' : editUser ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!deleteTarget} title="Delete User" message={`Delete ${deleteTarget?.displayName ?? 'this user'}? Their account will be permanently removed and they will lose access immediately.`} confirmLabel={deleting ? 'Deleting...' : 'Delete User'} dangerous onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
