// ConsoleModal.tsx: 任务控制台弹窗——HTTP 轮询最新 500 行输出，自动滚动到底部，带开/关动画
import { useEffect, useRef, useState } from 'react'
import { api, type TaskOutput } from '../api'
import { useDelayedUnmount } from '../hooks/useDelayedUnmount'
import { STATUS_META } from './status'
import { CloseIcon, SpinnerIcon, StopIcon } from './icons'

/** 输出轮询间隔（毫秒） */
const POLL_INTERVAL = 1500

interface ConsoleModalProps {
  /** 是否打开弹窗 */
  open: boolean
  taskId: string
  onClose: () => void
  onStop: () => void
}

export default function ConsoleModal({ open, taskId, onClose, onStop }: ConsoleModalProps) {
  const { render, closing } = useDelayedUnmount(open)
  const [data, setData] = useState<TaskOutput | null>(null)
  const [error, setError] = useState('')
  const consoleRef = useRef<HTMLDivElement>(null)

  // 每次打开时重置内部状态（组件常驻渲染）
  useEffect(() => {
    if (open) {
      setData(null)
      setError('')
    }
  }, [open, taskId])

  // 轮询输出与任务状态（仅打开期间）
  useEffect(() => {
    if (!open || !taskId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await api.output(taskId)
        if (!cancelled) {
          setData(res)
          setError('')
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '读取输出失败')
      }
    }
    load()
    const timer = setInterval(load, POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [open, taskId])

  // 新输出到达时滚动到底部
  useEffect(() => {
    const el = consoleRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [data?.lines.length])

  const meta = data ? STATUS_META[data.task.status] : null

  if (!render) return null

  return (
    <div className={`modal-overlay ${closing ? 'closing' : ''}`} onClick={onClose}>
      <div
        className="modal-card flex h-[76vh] w-[820px] max-w-[92vw] flex-col p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="mb-4 flex items-center gap-2">
          {meta && (
            <span
              className={`status-dot ${meta.pulse ? 'status-dot-pulse' : ''}`}
              style={{ background: meta.color, color: meta.color }}
            />
          )}
          <span
            className="flex-1 truncate font-semibold"
            style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}
          >
            {data?.task.name ?? '加载中…'}
          </span>
          {meta && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: meta.color, fontWeight: 600 }}>
              {meta.label}
              {data?.task.exitCode !== null &&
                data?.task.exitCode !== undefined &&
                data.task.status !== 'running' &&
                `（退出码 ${data.task.exitCode}）`}
            </span>
          )}
          {data?.task.status === 'running' && (
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
              onClick={onStop}
            >
              <StopIcon width={12} height={12} />
              停止
            </button>
          )}
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

        {/* 命令行信息 */}
        {data && (
          <div
            className="mb-3 truncate font-mono"
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}
          >
            $ {[data.task.command, ...data.task.args].join(' ')}
            {data.task.workDir ? `　（工作目录 ${data.task.workDir}）` : ''}
          </div>
        )}

        {/* 控制台输出 */}
        <div ref={consoleRef} className="console-area flex-1 p-4">
          {error ? (
            <span style={{ color: '#fca5a5' }}>{error}</span>
          ) : data && data.lines.length > 0 ? (
            data.lines.map((line, i) => (
              <div key={i}>{line || '\u00A0'}</div>
            ))
          ) : (
            <span className="flex items-center gap-2" style={{ color: '#94a3b8' }}>
              <SpinnerIcon width={13} height={13} />
              {data ? '暂无输出' : '加载输出中…'}
            </span>
          )}
        </div>

        <div
          className="mt-3 text-right"
          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}
        >
          保留最新 {data?.lines.length ?? 0} / 500 行 · 每 1.5 秒自动刷新
        </div>
      </div>
    </div>
  )
}
