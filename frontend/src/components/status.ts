// status.ts: 任务状态的展示元信息（文案、颜色、是否呼吸动画）
import type { TaskStatus } from '../api'

export interface StatusMeta {
  label: string
  color: string
  /** 状态点是否带呼吸动画（运行中 / 异常） */
  pulse: boolean
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  running: { label: '运行中', color: 'var(--success)', pulse: true },
  exited: { label: '已退出', color: 'var(--icon-muted)', pulse: false },
  crashed: { label: '错误退出', color: 'var(--destructive)', pulse: true },
  failed: { label: '启动失败', color: 'var(--destructive)', pulse: true },
  stopped: { label: '已停止', color: 'var(--icon-muted)', pulse: false },
}
