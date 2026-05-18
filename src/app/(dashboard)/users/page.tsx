'use client'
import { useState, useCallback } from 'react'
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

const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function generatePassword(): string {
  return Array.from({ length: 12 }, () =>
    PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)]
  ).join('')
}

function getNextOperatorId(users: AppUser[]): string {
  const opPattern = /^OP-(\d+)$/
  let maxNum = 0
  for (const u of users) {
    const match = opPattern.exec(u.displayName)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  }
  const next = maxNum + 1
  return `OP-${String(next).padStart(3, '0')}`
}

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
  const [copied, setCopied] = useState(false)

  const openCreate = useCallback(() => {
    setEditUser(null)
    setFormError(null)
    const nextId = getNextOperatorId(users)
    setForm({ ...EMPTY_FORM, displayName: nextId, password: generatePassword() })
    setShowForm(true)
  }, [users])

  function openEdit(u: AppUser) {
    setEditUser(u)
    setForm({ displayName: u.displayName, email: u.email, password: '', role: u.role, workstationIds: u.workstationIds.join(', ') })
    setFormError(null)
    setShowForm(true)
  }

  function handleRoleChange(newRole: Role) {
    setForm(f => {
      if (!editUser && newRole === 'operator') {
        return { ...f, role: newRole, displayName: getNextOperatorId(users), password: generatePassword() }
      }
      if (!editUser && f.role === 'operator' && newRole !== 'operator') {
        // switching away from operator — clear the auto-generated values
        return { ...f, role: newRole, displayName: '', password: '' }
      }
      return { ...f, role: newRole }
    })
  }

  function handleRegeneratePassword() {
    setForm(f => ({ ...f, password: generatePassword() }))
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(form.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silently ignore clipboard errors (e.g. in non-HTTPS contexts)
    }
  }

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
  const isOperatorCreate = !editUser && form.role === 'operator'

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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isOperatorCreate ? 'Operator ID' : 'Full Name'}
                    {isOperatorCreate && <span className="ml-1 text-xs font-normal text-gray-400">(auto-generated, editable)</span>}
                  </label>
                  <input
                    required
                    value={form.displayName}
                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={isOperatorCreate ? 'OP-001' : 'Full name'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                    {isOperatorCreate && <span className="ml-1 text-xs font-normal text-gray-400">(auto-generated)</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-wide"
                      placeholder="Min 6 characters"
                    />
                    {isOperatorCreate && (
                      <button
                        type="button"
                        onClick={handleCopy}
                        title="Copy password"
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          copied
                            ? 'border-green-400 bg-green-50 text-green-700'
                            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {copied ? 'Copied!' : (
                          <span className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                  {isOperatorCreate && (
                    <button
                      type="button"
                      onClick={handleRegeneratePassword}
                      className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      ↺ Regenerate
                    </button>
                  )}
                </div>
              </>)}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => handleRoleChange(e.target.value as Role)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLES.filter(r => currentRole === 'super_admin' || r !== 'super_admin').map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
                </select>
              </div>
              {needsWorkstations && <div><label className="block text-sm font-medium text-gray-700 mb-1">Assigned Workstations</label><input value={form.workstationIds} onChange={e => setForm(f => ({ ...f, workstationIds: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="ws_01, ws_02" /><p className="text-xs text-gray-400 mt-1">Comma-separated workstation IDs</p></div>}
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
