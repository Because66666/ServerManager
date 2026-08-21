// ConfirmDialog.tsx: 统一模态确认弹窗——危险/主色操作二次确认，内置 loading 轻量遮罩，带开/关动画
import type { ReactNode } from 'react'
import { useDelayedUnmount } from '../hooks/useDelayedUnmount'
import { SpinnerIcon } from './icons'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { render, closing } = useDelayedUnmount(open)
  if (!render) return null

  const confirmColor = variant === 'danger' ? 'var(--destructive)' : 'var(--primary)'
  const btnClass =
    'flex h-8 cursor-pointer items-center gap-1.5 px-3 outline-none transition-all duration-150'
  const btnStyle = {
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    boxShadow: 'var(--shadow-sm)',
  } as const

  return (
    <div className={`modal-overlay ${closing ? 'closing' : ''}`} onClick={loading ? undefined : onCancel}>
      <div
        className="modal-card relative w-[360px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mb-2 font-semibold"
          style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}
        >
          {title}
        </div>
        <div
          className="mb-6"
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          {message}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={`btn-text ${btnClass}`}
            style={{ ...btnStyle, color: 'var(--text-secondary)' }}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="btn-primary flex h-8 cursor-pointer items-center gap-1.5 px-3 outline-none transition-all duration-150"
            style={{ ...btnStyle, backgroundColor: confirmColor, color: '#ffffff' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmText}
          </button>
        </div>

        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              borderRadius: 'var(--radius-xl)',
              background: 'color-mix(in srgb, var(--card) 70%, transparent)',
            }}
          >
            <SpinnerIcon width={18} height={18} style={{ color: 'var(--primary)' }} />
          </div>
        )}
      </div>
    </div>
  )
}
