// RingCard.tsx: 环形进度卡片——SVG 圆环近似实时展示百分比占用
interface RingCardProps {
  /** 卡片标题 */
  label: string
  /** 百分比 0-100 */
  percent: number
  /** 圆环下方的补充说明文本 */
  sub?: string
}

const SIZE = 148
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function RingCard({ label, percent, sub }: RingCardProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = CIRCUMFERENCE * (1 - clamped / 100)
  const high = clamped >= 90
  const ringColor = high ? 'var(--destructive)' : 'var(--primary)'

  return (
    <div className="panel-card flex flex-1 flex-col items-center gap-3 p-6">
      <div
        className="self-start font-semibold"
        style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--background-secondary)"
            strokeWidth={STROKE}
          />
          <circle
            className="ring-progress"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold tabular-nums"
            style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--text-primary)' }}
          >
            {clamped.toFixed(0)}
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              %
            </span>
          </span>
        </div>
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
