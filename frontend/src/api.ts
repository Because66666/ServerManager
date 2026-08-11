// api.ts: 后端 API 封装——fetch + 会话 token 管理 + 类型定义
export type TaskStatus = 'running' | 'exited' | 'crashed' | 'failed' | 'stopped'

export interface Task {
  id: string
  name: string
  command: string
  args: string[]
  workDir?: string | null
  status: TaskStatus
  exitCode?: number | null
  error?: string | null
  createdAt: number
}

export interface SystemStats {
  cpuUsage: number
  memoryUsed: number
  memoryTotal: number
  memoryUsage: number
}

export interface TaskOutput {
  task: Task
  lines: string[]
}

const TOKEN_KEY = 'server_manager_token'

export const UNAUTHORIZED_EVENT = 'sm:unauthorized'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options.body) headers['Content-Type'] = 'application/json'

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new Error('未登录或会话已失效')
  }
  if (res.status === 204) {
    return undefined as T
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `请求失败 (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  login: (key: string) =>
    request<{ token: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ key }),
    }),

  logout: () => request<void>('/api/logout', { method: 'POST' }),

  stats: () => request<SystemStats>('/api/stats'),

  tasks: () => request<Task[]>('/api/tasks'),

  createTask: (payload: {
    name: string
    command: string
    args: string[]
    workDir?: string
  }) =>
    request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  output: (id: string) => request<TaskOutput>(`/api/tasks/${id}/output`),

  stop: (id: string) => request<Task>(`/api/tasks/${id}/stop`, { method: 'POST' }),

  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
}

/** 字节数格式化为可读文本 */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
