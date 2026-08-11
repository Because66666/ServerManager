// TaskCard.tsx: 任务卡片——状态点、命令摘要、停止/删除操作（删除随父级悬停显现）
import type { Task } from '../api'
import { STATUS_META } from './status'
import { StopIcon, TrashIcon } from './icons'

interface TaskCardProps {
  task: Task
  onOpen: (task: Task) => void
  onStop: (task: Task) => void
  onDelete: (task: Task) => void
}

export default function TaskCard({ task, onOpen, onStop, onDelete }: TaskCardProps) {
  const meta = STATUS_META[task.status]
  const commandLine = [task.command, ...task.args].join(' ')

  return (
    <div
      className="inner-card group cursor-pointer p-4"
      onClick={() => onOpen(task)}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`status-dot ${meta.pulse ? 'status-dot-pulse' : ''}`}
          style={{ background: meta.color, color: meta.color }}
        />
        <span
          className="flex-1 truncate font-semibold"
          style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}
        >
          {task.name}
        </span>

        {task.status === 'running' && (
          <button
            type="button"
            title="停止任务"
            className="btn-icon flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center opacity-0 outline-none transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            style={{ color: 'var(--icon-muted)', borderRadius: 'var(--radius-md)' }}
            onClick={(e) => {
              e.stopPropagation()
              onStop(task)
            }}
          >
            <StopIcon width={12} height={12} />
          </button>
        )}
        <button
          type="button"
          title="删除任务"
          className="btn-icon-danger flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center opacity-0 outline-none transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          style={{ color: 'var(--destructive)', borderRadius: 'var(--radius-md)' }}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task)
          }}
        >
          <TrashIcon width={13} height={13} />
        </button>
      </div>

      <div
        className="truncate font-mono"
        style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}
      >
        {commandLine}
      </div>

      <div
        className="mt-2 flex items-center gap-2"
        style={{ fontSize: 'var(--font-size-xs)' }}
      >
        <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
        {task.exitCode !== null && task.exitCode !== undefined && task.status !== 'running' && (
          <span style={{ color: 'var(--text-secondary)' }}>退出码 {task.exitCode}</span>
        )}
        {task.error && (
          <span className="truncate" style={{ color: 'var(--destructive)' }}>
            {task.error}
          </span>
        )}
      </div>
    </div>
  )
}
