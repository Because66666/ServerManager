// TaskStatusRing.tsx: 任务状态环卡片——单环分段展示各状态任务数量（运行中/错误/已停止/已退出），中心为总数
import type { Task, TaskStatus } from '../api'

const SIZE = 200
const STROKE = 22
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** 状态分组：展示顺序 + 颜色 + 文案 */
const SEGMENTS: {
  key: string
  label: string
  color: string
  statuses: TaskStatus[]
}[] = [
  { key: 'running', label: '运行中', color: 'var(--success)', statuses: ['running'] },
  { key: 'error', label: '错误', color: 'var(--destructive)', statuses: ['crashed', 'failed'] },
  { key: 'stopped', label: '主动停止', color: '#64748b', statuses: ['stopped'] },
  { key: 'exited', label: '已退出', color: '#93c5fd', statuses: ['exited'] },
]

export default function TaskStatusRing({ tasks }: { tasks: Task[] }) {
  const counts = SEGMENTS.map((seg) => ({
    ...seg,
    count: tasks.filter((t) => seg.statuses.includes(t.status)).length,
  }))
  const total = tasks.length

  // 依次累加各段起点
  let offset = 0

  return (
    <div className="panel-card flex flex-1 flex-col p-6">
      <div
        className="mb-4 font-semibold"
        style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}
      >
        任务状态
      </div>
      <div className="flex flex-1 items-center justify-center gap-8">
        <div className="relative" style={{ width: SIZE, height: SIZE, flexShrink: 0 }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--background-secondary)"
              strokeWidth={STROKE}
            />
            {total > 0 &&
              counts.map((seg) => {
                if (seg.count === 0) return null
                const len = (seg.count / total) * CIRCUMFERENCE
                const el = (
                  <circle
                    key={seg.key}
                    className="ring-progress"
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${len} ${CIRCUMFERENCE - len}`}
                    strokeDashoffset={-offset}
                  />
                )
                offset += len
                return el
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-bold tabular-nums"
              style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--text-primary)' }}
            >
              {total}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
              任务总数
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {counts.map((seg) => (
            <div key={seg.key} className="flex items-center gap-2">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: seg.color,
                  flexShrink: 0,
                }}
              />
              <span
                className="flex-1"
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}
              >
                {seg.label}
              </span>
              <span
                className="font-bold tabular-nums"
                style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}
              >
                {seg.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
