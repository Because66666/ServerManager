// ResourceRings.tsx: 资源占用卡片——三环同心环，从里到外依次为 CPU / 内存 / 磁盘占用，右侧图例展示数值
import { formatBytes, type SystemStats } from '../api'

const SIZE = 200
const STROKE = 13
const GAP = 5

/** 从外到内的半径：磁盘(外) / 内存(中) / CPU(内) */
const R_DISK = (SIZE - STROKE) / 2
const R_MEMORY = R_DISK - STROKE - GAP
const R_CPU = R_MEMORY - STROKE - GAP

/** 单个同心环：轨道 + 进度弧 */
function Ring({
  radius,
  percent,
  color,
}: {
  radius: number
  percent: number
  color: string
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const c = 2 * Math.PI * radius
  return (
    <g>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={radius}
        fill="none"
        stroke="var(--background-secondary)"
        strokeWidth={STROKE}
      />
      <circle
        className="ring-progress"
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped / 100)}
      />
    </g>
  )
}

interface LegendRowProps {
  color: string
  label: string
  percent: number
  sub?: string
}

function LegendRow({ color, label, percent, sub }: LegendRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 9999,
            background: color,
            flexShrink: 0,
          }}
        />
        <span
          className="flex-1"
          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}
        >
          {label}
        </span>
        <span
          className="font-bold tabular-nums"
          style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}
        >
          {percent.toFixed(0)}
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            %
          </span>
        </span>
      </div>
      {sub && (
        <div
          className="pl-4"
          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

export default function ResourceRings({ stats }: { stats: SystemStats | null }) {
  const cpu = stats?.cpuUsage ?? 0
  const memory = stats?.memoryUsage ?? 0
  const disk = stats?.diskUsage ?? 0

  return (
    <div className="panel-card flex flex-1 flex-col p-6">
      <div
        className="mb-4 font-semibold"
        style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}
      >
        资源占用
      </div>
      <div className="flex flex-1 items-center justify-center gap-8">
        <svg width={SIZE} height={SIZE} className="-rotate-90" style={{ flexShrink: 0 }}>
          <Ring radius={R_DISK} percent={disk} color="#93c5fd" />
          <Ring radius={R_MEMORY} percent={memory} color="#3b82f6" />
          <Ring radius={R_CPU} percent={cpu} color="var(--primary)" />
        </svg>
        <div className="flex flex-col gap-4">
          <LegendRow
            color="var(--primary)"
            label="CPU 占用"
            percent={cpu}
            sub="整机实时占用"
          />
          <LegendRow
            color="#3b82f6"
            label="内存占用"
            percent={memory}
            sub={
              stats
                ? `${formatBytes(stats.memoryUsed)} / ${formatBytes(stats.memoryTotal)}`
                : '加载中…'
            }
          />
          <LegendRow
            color="#93c5fd"
            label="磁盘占用"
            percent={disk}
            sub={
              stats
                ? `${formatBytes(stats.diskUsed)} / ${formatBytes(stats.diskTotal)}`
                : '加载中…'
            }
          />
        </div>
      </div>
    </div>
  )
}
