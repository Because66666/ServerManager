// CreateTaskModal.tsx: 新建任务弹窗——名称、命令、参数、工作目录表单
import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { CloseIcon, PlusIcon, SpinnerIcon } from './icons'

interface CreateTaskModalProps {
  onClose: () => void
  onCreated: () => void
}

export default function CreateTaskModal({ onClose, onCreated }: CreateTaskModalProps) {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [workDir, setWorkDir] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!name.trim() || !command.trim()) {
      setError('任务名称与启动命令不能为空')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.createTask({
        name: name.trim(),
        command: command.trim(),
        args: args.trim() ? args.trim().split(/\s+/) : [],
        workDir: workDir.trim() || undefined,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建任务失败')
      setLoading(false)
    }
  }

  const labelStyle = { fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card w-[440px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center">
          <span
            className="flex-1 font-semibold"
            style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}
          >
            新建任务
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
              {loading ? <SpinnerIcon width={13} height={13} /> : <PlusIcon width={13} height={13} />}
              {loading ? '创建中…' : '创建并启动'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
