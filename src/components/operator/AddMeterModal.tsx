'use client'

import { useState } from 'react'
import { createAdHocMeter, findMeterBySerialNumber } from '@/lib/firebase/firestore'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (meterId: string) => void
}

export function AddMeterModal({ open, onClose, onSuccess }: Props) {
  const [serialNumber, setSerialNumber] = useState('')
  const [meterType, setMeterType] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!open) return null

  const canSubmit = serialNumber.trim().length > 0 && meterType.trim().length > 0 && !loading

  function handleSerialNumberChange(value: string) {
    setSerialNumber(value)
    // Clear duplicate error when user edits the field
    if (duplicateError) setDuplicateError(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setDuplicateError(null)
    setSubmitError(null)

    try {
      const existingId = await findMeterBySerialNumber(serialNumber.trim())
      if (existingId !== null) {
        setDuplicateError('A meter with this serial number already exists')
        setLoading(false)
        return
      }

      const meterId = await createAdHocMeter({
        serialNumber: serialNumber.trim(),
        meterType: meterType.trim(),
        note: note.trim() || undefined,
      })

      // Reset form
      setSerialNumber('')
      setMeterType('')
      setNote('')
      onSuccess(meterId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setSubmitError(message)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setSerialNumber('')
    setMeterType('')
    setNote('')
    setDuplicateError(null)
    setSubmitError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Add Meter to Queue</h2>
        <p className="text-sm text-gray-500 mb-5">
          Manually add a meter to the WS1 incoming inspection queue.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Serial Number */}
          <div className="mb-4">
            <label htmlFor="add-meter-serial" className="block text-sm font-medium text-gray-700 mb-1">
              Serial Number <span className="text-red-500">*</span>
            </label>
            <input
              id="add-meter-serial"
              type="text"
              required
              placeholder="Enter meter serial number"
              value={serialNumber}
              onChange={(e) => handleSerialNumberChange(e.target.value)}
              disabled={loading}
              className={`w-full rounded-lg border px-3 text-gray-900 placeholder-gray-400 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:bg-gray-50 disabled:text-gray-400
                ${duplicateError ? 'border-red-400' : 'border-gray-300'}
                min-h-[44px]`}
            />
            {duplicateError !== null && (
              <p className="mt-1 text-xs text-red-600">{duplicateError}</p>
            )}
          </div>

          {/* Meter Type */}
          <div className="mb-4">
            <label htmlFor="add-meter-type" className="block text-sm font-medium text-gray-700 mb-1">
              Meter Type / Model <span className="text-red-500">*</span>
            </label>
            <input
              id="add-meter-type"
              type="text"
              required
              placeholder="Enter meter type / model"
              value={meterType}
              onChange={(e) => setMeterType(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 text-gray-900
                placeholder-gray-400 text-sm focus:outline-none focus:ring-2
                focus:ring-blue-500 focus:border-transparent
                disabled:bg-gray-50 disabled:text-gray-400 min-h-[44px]"
            />
          </div>

          {/* Note (optional) */}
          <div className="mb-6">
            <label htmlFor="add-meter-note" className="block text-sm font-medium text-gray-700 mb-1">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="add-meter-note"
              type="text"
              placeholder="Reason for manual addition (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-3 text-gray-900
                placeholder-gray-400 text-sm focus:outline-none focus:ring-2
                focus:ring-blue-500 focus:border-transparent
                disabled:bg-gray-50 disabled:text-gray-400 min-h-[44px]"
            />
          </div>

          {submitError !== null && (
            <p className="mb-4 text-xs text-red-600">{submitError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg
                hover:bg-gray-50 disabled:opacity-50 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm rounded-lg text-white font-medium
                bg-blue-600 hover:bg-blue-700
                disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {loading ? 'Adding…' : 'Add to Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
