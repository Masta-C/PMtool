'use client'
import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createUserFn, setUserRoleFn, deleteUserFn, resetUserPasswordFn } from '@/lib/firebase/functions'
import { stationLabel } from '@/lib/stages'
import type { Role, AppUser } from '@/types/user'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Roles available when creating / editing a user. super_admin is excluded
 *  — those accounts are provisioned manually outside the app. */
const ROLES: Role[] = ['admin', 'supervisor', 'operator', 'qa']

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  operator: 'Operator',
  qa: 'QA',
}

const ROLE_BADGE: Record<Role, { bg: string; color: string }> = {
  admin:      { bg: '#1e3a5f', color: '#60a5fa' },
  supervisor: { bg: '#1e3a5f', color: '#93c5fd' },
  operator:   { bg: '#14362b', color: '#4ade80' },
  qa:         { bg: '#3b2507', color: '#fb923c' },
}

const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function generatePassword(): string {
  return Array.from({ length: 8 }, () =>
    PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)]
  ).join('')
}

/** Auto-generates the next Op ID in the format OP-0001, OP-0002, etc.
 *  Scans existing users whose displayName matches the OP-XXXX pattern. */
function getNextOpId(users: AppUser[]): string {
  const opPattern = /^OP-(\d+)$/
  let maxNum = 0
  for (const u of users) {
    const match = opPattern.exec(u.displayName)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  }
  return `OP-${String(maxNum + 1).padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateFormData {
  operatorName: string
  email: string
  role: Role
}

interface PostSaveInfo {
  opId: string
  password: string
  displayName: string
}

const EMPTY_FORM: CreateFormData = { operatorName: '', email: '', role: 'operator' }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamPage() {
  const { user: currentUser, role: currentRole } = useAuth()
  const { users, loading } = useUsers()

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Post-save reveal state (password + op ID shown once)
  const [postSave, setPostSave] = useState<PostSaveInfo | null>(null)
  const [copied, setCopied] = useState(false)

  // Edit role state
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [editRole, setEditRole] = useState<Role>('operator')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Search state
  const [search, setSearch] = useState('')

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Reset password state
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Handlers — create
  // ---------------------------------------------------------------------------

  const openCreate = useCallback(() => {
    setForm(EMPTY_FORM)
    setFormError(null)
    setPostSave(null)
    setShowForm(true)
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    const opId = getNextOpId(users)
    const password = generatePassword()

    try {
      await createUserFn({
        email: form.email,
        password,
        displayName: form.operatorName,
        role: form.role,
        workstationIds: [],
      })
      setShowForm(false)
      setPostSave({ opId, password, displayName: form.operatorName })
      setForm(EMPTY_FORM)
    } catch (err: unknown) {
      setFormError((err as { message?: string }).message ?? 'Failed to create user. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyPassword() {
    if (!postSave) return
    try {
      await navigator.clipboard.writeText(postSave.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silently ignore clipboard errors (e.g. in non-HTTPS contexts)
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers — edit role
  // ---------------------------------------------------------------------------

  function openEdit(u: AppUser) {
    setEditUser(u)
    setEditRole(u.role)
    setEditError(null)
    setShowEditModal(true)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setEditSubmitting(true)
    setEditError(null)
    try {
      await setUserRoleFn({ targetUid: editUser.uid, role: editRole })
      setShowEditModal(false)
    } catch (err: unknown) {
      setEditError((err as { message?: string }).message ?? 'Failed to update role.')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers — delete
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteTarget || !currentUser) return
    setDeleting(true)
    try {
      await deleteUserFn({ targetUid: deleteTarget.uid })
      // Write audit log — immutable record of the deletion
      await addDoc(collection(db, 'auditLog'), {
        action: 'USER_DELETED',
        actorUid: currentUser.uid,
        actorRole: currentRole,
        targetMeterId: null,
        stageId: null,
        before: {
          uid: deleteTarget.uid,
          displayName: deleteTarget.displayName,
          email: deleteTarget.email,
          role: deleteTarget.role,
        },
        after: null,
        timestamp: serverTimestamp(),
      })
      setDeleteTarget(null)
    } catch (err: unknown) {
      alert((err as { message?: string }).message ?? 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers — reset password
  // ---------------------------------------------------------------------------

  async function handleResetPassword() {
    if (!resetTarget || !currentUser) return
    setResetting(true)
    setResetError(null)
    const newPassword = generatePassword()
    try {
      await resetUserPasswordFn({ targetUid: resetTarget.uid, newPassword })
      // Write audit log — records who reset whose password and when
      await addDoc(collection(db, 'auditLog'), {
        action: 'PASSWORD_RESET',
        actorUid: currentUser.uid,
        actorRole: currentRole,
        targetMeterId: null,
        stageId: null,
        before: null,
        after: {
          uid: resetTarget.uid,
          displayName: resetTarget.displayName,
          email: resetTarget.email,
        },
        timestamp: serverTimestamp(),
      })
      const displayName = resetTarget.displayName
      setResetTarget(null)
      // Reuse the postSave banner to reveal the new password
      setPostSave({ opId: '', password: newPassword, displayName })
    } catch (err: unknown) {
      setResetError((err as { message?: string }).message ?? 'Failed to reset password. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Workstation column helper
  // ---------------------------------------------------------------------------

  function getWorkstationLabel(user: AppUser): string {
    const ids = user.workstationIds
    if (!ids || ids.length === 0) return '—'
    return ids.map(id => stationLabel(id.replace('ws_', 'stage_'))).join(', ')
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filteredUsers = users.filter(u =>
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen p-8" style={{ background: 'var(--color-content-bg)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm mt-1 text-gray-500">
            {loading ? 'Loading...' : search
              ? `${filteredUsers.length} of ${users.length} account${users.length !== 1 ? 's' : ''}`
              : `${users.length} account${users.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {currentRole === 'admin' && (
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-primary)' }}
          >
            + New User
          </button>
        )}
      </div>

      {/* Post-save password reveal */}
      {postSave && (
        <div
          className="mb-6 rounded-xl p-5 border"
          style={{ background: '#0d2b1a', borderColor: '#22c55e' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-green-400 mb-1">
                {postSave.opId ? 'User created successfully' : 'Password reset successfully'}
              </p>
              <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Save the password now — it will not be shown again.
              </p>
              <div className="flex flex-wrap gap-6">
                <div>
                  <span className="block text-xs font-medium text-green-500 mb-0.5">Operator Name</span>
                  <span className="text-sm font-mono text-white">{postSave.displayName}</span>
                </div>
                {postSave.opId && (
                  <div>
                    <span className="block text-xs font-medium text-green-500 mb-0.5">Op ID (auto-generated)</span>
                    <span className="text-sm font-mono text-white">{postSave.opId}</span>
                  </div>
                )}
                <div>
                  <span className="block text-xs font-medium text-green-500 mb-0.5">Temporary Password</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono tracking-widest text-white">{postSave.password}</span>
                    <button
                      onClick={handleCopyPassword}
                      className="px-2 py-0.5 rounded text-xs font-medium border transition-colors"
                      style={
                        copied
                          ? { background: '#14532d', borderColor: '#22c55e', color: '#4ade80' }
                          : { background: 'transparent', borderColor: '#4ade80', color: '#4ade80' }
                      }
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setPostSave(null)}
              className="text-green-600 hover:text-green-400 text-lg leading-none flex-shrink-0"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Search box */}
      {!loading && (
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 mb-4"
          style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
        />
      )}

      {/* Team table */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading users…</p>
      ) : (
        <div
          className="glass-card rounded-xl overflow-hidden"
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-card-border)' }}>
                {['Name', 'Email', 'Role', 'Workstation', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#6b7280' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => (
                <tr
                  key={u.uid}
                  style={{
                    borderTop: i === 0 ? undefined : '1px solid var(--color-card-border)',
                  }}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {u.displayName}
                    {u.uid === currentUser?.uid && (
                      <span className="ml-2 text-xs text-gray-400">(You)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: ROLE_BADGE[u.role]?.bg ?? '#1e2a3a',
                        color: ROLE_BADGE[u.role]?.color ?? '#94a3b8',
                      }}
                    >
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {getWorkstationLabel(u)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {(currentRole === 'admin' || currentRole === 'supervisor') && (
                        <button
                          onClick={() => openEdit(u)}
                          className="border border-blue-300 text-blue-600 bg-white hover:bg-blue-50 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {(currentRole === 'admin' || currentRole === 'supervisor') && (
                        <button
                          onClick={() => { setResetTarget(u); setResetError(null) }}
                          className="border border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                        >
                          Reset Password
                        </button>
                      )}
                      {(currentRole === 'admin' || currentRole === 'supervisor') && u.uid !== currentUser?.uid && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: '#9ca3af' }}
                  >
                    {search ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create user modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border"
            style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-5">New User</h2>
            <form onSubmit={handleCreate} className="space-y-4">

              {/* Operator Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Operator Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={form.operatorName}
                  onChange={e => setForm(f => ({ ...f, operatorName: e.target.value }))}
                  placeholder="Full name"
                  className="w-full rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2"
                  style={{
                    background: 'var(--color-content-bg)',
                    border: '1px solid var(--color-card-border)',
                    // @ts-expect-error -- CSS variable for ring color
                    '--tw-ring-color': 'var(--color-primary)',
                  }}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                  className="w-full rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2"
                  style={{
                    background: 'var(--color-content-bg)',
                    border: '1px solid var(--color-card-border)',
                    // @ts-expect-error -- CSS variable for ring color
                    '--tw-ring-color': 'var(--color-primary)',
                  }}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  className="w-full rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2"
                  style={{
                    background: 'var(--color-content-bg)',
                    border: '1px solid var(--color-card-border)',
                    // @ts-expect-error -- CSS variable for ring color
                    '--tw-ring-color': 'var(--color-primary)',
                  }}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </div>

              {/* Note about auto-generated fields */}
              <p className="text-xs rounded-lg px-3 py-2 text-gray-500 bg-gray-50 border border-gray-200">
                Op ID and temporary password will be auto-generated and shown once after the user is created.
              </p>

              {formError && (
                <p className="text-sm text-red-500">{formError}</p>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-80"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {submitting ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit role modal */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border"
            style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Edit User</h2>
            <p className="text-sm text-gray-500 mb-5">{editUser.displayName}</p>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as Role)}
                  className="w-full rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2"
                  style={{
                    background: 'var(--color-content-bg)',
                    border: '1px solid var(--color-card-border)',
                    // @ts-expect-error -- CSS variable for ring color
                    '--tw-ring-color': 'var(--color-primary)',
                  }}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              {editError && <p className="text-sm text-red-500">{editError}</p>}
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-80"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {editSubmitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="⚠️ Delete User"
        message={`You are about to permanently delete ${deleteTarget?.displayName ?? 'this user'} (${deleteTarget?.email ?? ''}). Their account will be removed immediately and this action cannot be undone. This will be logged in the audit trail.`}
        confirmLabel={deleting ? 'Deleting…' : 'Yes, Delete Permanently'}
        dangerous
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Reset password confirm modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border"
            style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset Password</h2>
            <p className="text-sm text-gray-500 mb-4">
              Reset password for <span className="font-semibold text-gray-700">{resetTarget.displayName}</span>? A new temporary password will be generated and shown once. Share it with them securely. This action will be recorded in the audit log.
            </p>
            {resetError && <p className="text-sm text-red-500 mb-3">{resetError}</p>}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setResetTarget(null); setResetError(null) }}
                disabled={resetting}
                className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetting}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-80"
                style={{ background: '#d97706' }}
              >
                {resetting ? 'Resetting…' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
