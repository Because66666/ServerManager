// Dashboard.tsx: 主界面——顶栏、资源三环与任务状态环、任务列表（新建/编辑/停止/删除）与各类弹窗编排
import { useCallback, useEffect, useState } from 'react'
import { api, type SystemStats, type Task } from '../api'
import ResourceRings from '../components/ResourceRings'
import TaskStatusRing from '../components/TaskStatusRing'
import TaskCard from '../components/TaskCard'
import ConsoleModal from '../components/ConsoleModal'
import TaskFormModal from '../components/TaskFormModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { LogoutIcon, PlusIcon, RefreshIcon, ServerIcon, TerminalIcon } from '../components/icons'

/** 任务列表轮询间隔（毫秒） */
const TASKS_POLL_INTERVAL = 3000
/** 整机资源轮询间隔（毫秒） */
const STATS_POLL_INTERVAL = 2000

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [consoleTaskId, setConsoleTaskId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
  const [pendingStop, setPendingStop] = useState<Task | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // 整机资源轮询
  useEffect(() => {
    let cancelled = false
    const load = () =>
      api
        .stats()
        .then((s) => !cancelled && setStats(s))
        .catch(() => {})
    load()
    const timer = setInterval(load, STATS_POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const refreshTasks = useCallback(async () => {
    try {
      setTasks(await api.tasks())
    } catch {
      // 轮询失败静默忽略，等待下一次刷新
    }
  }, [])

  // 任务列表轮询
  useEffect(() => {
    refreshTasks()
    const timer = setInterval(refreshTasks, TASKS_POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [refreshTasks])

  const handleStopConfirmed = async () => {
    if (!pendingStop) return
    setConfirmLoading(true)
    try {
      await api.stop(pendingStop.id)
      setPendingStop(null)
    } finally {
      setConfirmLoading(false)
      refreshTasks()
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!pendingDelete) return
    setConfirmLoading(true)
    try {
      await api.remove(pendingDelete.id)
      setPendingDelete(null)
      if (consoleTaskId === pendingDelete.id) setConsoleTaskId(null)
    } finally {
      setConfirmLoading(false)
      refreshTasks()
    }
  }

  const handleStopFromConsole = async () => {
    if (!consoleTaskId) return
    await api.stop(consoleTaskId).catch(() => {})
    refreshTasks()
  }

  const runningCount = tasks.filter((t) => t.status === 'running').length
  const errorCount = tasks.filter(
    (t) => t.status === 'crashed' || t.status === 'failed',
  ).length

  return (
    <div className="view-enter min-h-full" style={{ background: 'var(--background-secondary)' }}>
      {/* 顶栏 */}
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-6 pt-6 pb-2">
        <div
          className="flex h-9 w-9 items-center justify-center"
          style={{
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary)',
            color: '#ffffff',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <ServerIcon width={18} height={18} />
        </div>
        <span
          className="flex-1 font-bold"
          style={{ fontSize: 'var(--font-size-xl)', color: 'var(--text-primary)' }}
        >
          ServerManager
        </span>

        {/* 右侧工具分组容器 */}
        <div
          className="flex items-center gap-0.5 p-1"
          style={{
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--card)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <button
            type="button"
            title="刷新"
            className="btn-icon flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-150"
            style={{ color: 'var(--icon-muted)', borderRadius: 'var(--radius-md)' }}
            onClick={refreshTasks}
          >
            <RefreshIcon width={15} height={15} />
          </button>
          <button
            type="button"
            title="退出登录"
            className="btn-icon flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-150"
            style={{ color: 'var(--icon-muted)', borderRadius: 'var(--radius-md)' }}
            onClick={onLogout}
          >
            <LogoutIcon width={15} height={15} />
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 pt-4 pb-10">
        {/* 资源三环 + 任务状态环 */}
        <section className="flex gap-5">
          <ResourceRings stats={stats} />
          <TaskStatusRing tasks={tasks} />
        </section>

        {/* 任务面板 */}
        <section className="panel-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="flex-1 font-semibold"
              style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}
            >
              任务列表
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
              {runningCount} 运行中{errorCount > 0 ? ` · ${errorCount} 异常` : ''}
            </span>
            <button
              type="button"
              className="btn-primary flex h-8 cursor-pointer items-center gap-1.5 px-3 outline-none transition-all duration-150"
              style={{
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
              }}
              onClick={() => {
                setEditingTask(null)
                setFormOpen(true)
              }}
            >
              <PlusIcon width={13} height={13} />
              新建任务
            </button>
          </div>

          {tasks.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2 py-14"
              style={{ color: 'var(--text-secondary)' }}
            >
              <TerminalIcon width={26} height={26} style={{ color: 'var(--icon-muted)' }} />
              <span style={{ fontSize: 'var(--font-size-sm)' }}>
                暂无任务，点击「新建任务」启动你的第一个常驻进程
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={(t) => setConsoleTaskId(t.id)}
                  onEdit={(t) => {
                    setEditingTask(t)
                    setFormOpen(true)
                  }}
                  onStop={(t) => setPendingStop(t)}
                  onDelete={(t) => setPendingDelete(t)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 弹窗（常驻渲染，由组件内部管理开/关动画与延迟卸载） */}
      <TaskFormModal
        open={formOpen}
        task={editingTask}
        onClose={() => setFormOpen(false)}
        onSaved={refreshTasks}
      />
      <ConsoleModal
        open={!!consoleTaskId}
        taskId={consoleTaskId ?? ''}
        onClose={() => setConsoleTaskId(null)}
        onStop={handleStopFromConsole}
      />
      <ConfirmDialog
        open={!!pendingStop}
        title="停止任务"
        message={
          <>
            确定要停止任务「{pendingStop?.name}」吗？进程将被终止，任务仍会保留在列表中。
          </>
        }
        confirmText="停止"
        loading={confirmLoading}
        onConfirm={handleStopConfirmed}
        onCancel={() => setPendingStop(null)}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="删除任务"
        message={
          <>
            确定要删除任务「{pendingDelete?.name}」吗？
            {pendingDelete?.status === 'running' && '进程将被终止，'}
            输出记录将一并清除，此操作不可恢复。
          </>
        }
        variant="danger"
        confirmText="删除"
        loading={confirmLoading}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
