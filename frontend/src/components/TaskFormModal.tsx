// TaskFormModal.tsx: 任务表单弹窗——新建与编辑复用，编辑保存后由后端立即以新配置重启进程，带开/关动画
import { useEffect, useState, type FormEvent } from 'react'
import { api, type Task } from '../api'
import { useDelayedUnmount } from '../hooks/useDelayedUnmount'
import { CloseIcon, PencilIcon, PlusIcon, SpinnerIcon } from './icons'

interface TaskFormModalProps {
  /** 是否打开弹窗 */
  open: boolean
  /** 传入已有任务时为编辑模式，否则为新建模式 */
  task?: Task | null
  onClose: () => void
  onSaved: () => void
}

export default function TaskFormModal({ open, task, onClose, onSaved }: TaskFormModalProps) {
  const editing = !!task
  const { render, closing } = useDelayedUnmount(open)
  const [name, setName] = useState(task?.name ?? '')
  const [command, setCommand] = useState(task?.command ?? '')
  const [args, setArgs] = useState(task?.args.join(' ') ?? '')
  const [workDir, setWorkDir] = useState(task?.workDir ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 每次打开时重置表单（组件常驻渲染，需手动同步初始值）
  useEffect(() => {
    if (open) {
      setName(task?.name ?? '')
      setCommand(task?.command ?? '')
      setArgs(task?.args.join(' ') ?? '')
      setWorkDir(task?.workDir ?? '')
      setError('')
      setLoading(false)
    }
  }, [open, task])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!name.trim() || !command.trim()) {
      setError('任务名称与启动命令不能为空')
      return
    }
    setLoading(true)
    setError('')
    const payload = {
      name: name.trim(),
      command: command.trim(),
      args: args.trim() ? args.trim().split(/\s+/) : [],
      workDir: workDir.trim() || undefined,
    }
    try {
      if (editing) {
        await api.updateTask(task.id, payload)
      } else {
        await api.createTask(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : editing ? '保存失败' : '创建任务失败')
      setLoading(false)
    }
  }

  const labelStyle = { fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }

  if (!render) return null

  return (
    <div className={`modal-overlay ${closing ? 'closing' : ''}`} onClick={onClose}>
      <div className="modal-card w-[440px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center">
          <span
            className="flex-1 font-semibold"
            style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}
          >
            {editing ? '编辑任务' : '新建任务'}
          </span>
          <button
            type="button"
            title="关闭"
            className="btn-icon flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-150"
            style={{ color: 'var(--icon-muted)', borderRadius: 'var(--radius-md)' }}
            onClick={onClose}
          >
            <CloseIcon width={15} height={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span style={labelStyle}>任务名称 *</span>
            <input
              className="field-input"
              placeholder="如：数据同步服务"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span style={labelStyle}>启动命令 *</span>
            <input
              className="field-input font-mono"
              placeholder="如：python"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span style={labelStyle}>命令参数（空格分隔）</span>
            <input
              className="field-input font-mono"
              placeholder="如：server.py --port 9000"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span style={labelStyle}>工作目录（可选）</span>
            <input
              className="field-input font-mono"
              placeholder="如：D:\apps\myservice"
              value={workDir}
              onChange={(e) => setWorkDir(e.target.value)}
            />
          </label>

          {editing && (
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-secondary)',
                background: 'var(--background-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
              }}
            >
              保存后将终止当前进程，并立即以新配置重新启动。
            </div>
          )}

          {error && (
            <div
              className="view-enter"
              style={{ fontSize: 'var(--font-size-xs)', color: 'var(--destructive)' }}
            >
              {error}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              className="btn-text flex h-8 cursor-pointer items-center gap-1.5 px-3 outline-none transition-all duration-150"
              style={{
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-secondary)',
              }}
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex h-8 cursor-pointer items-center gap-1.5 px-3 outline-none transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
              }}
            >
              {loading ? (
                <SpinnerIcon width={13} height={13} />
              ) : editing ? (
                <PencilIcon width={13} height={13} />
              ) : (
                <PlusIcon width={13} height={13} />
              )}
              {loading ? '保存中…' : editing ? '保存并重启' : '创建并启动'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
