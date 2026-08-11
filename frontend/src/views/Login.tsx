// Login.tsx: 密钥登录页——居中卡片 + 密钥输入 + 错误提示
import { useState, type FormEvent } from 'react'
import { api, setToken } from '../api'
import { KeyIcon, ServerIcon, SpinnerIcon } from '../components/icons'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!key.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const { token } = await api.login(key.trim())
      setToken(token)
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
      setLoading(false)
    }
  }

  return (
    <div
      className="view-enter flex h-full items-center justify-center"
      style={{ background: 'var(--background-secondary)' }}
    >
      <div className="panel-card w-[380px] p-10">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center"
            style={{
              borderRadius: 'var(--radius-lg)',
              background: 'var(--primary)',
              color: '#ffffff',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <ServerIcon width={26} height={26} />
          </div>
          <div
            className="font-semibold"
            style={{ fontSize: 'var(--font-size-xl)', color: 'var(--text-primary)' }}
          >
            ServerManager
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            输入管理密钥以进入控制台
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <input
              className="field-input pr-9"
              type="password"
              placeholder="管理密钥"
              value={key}
              autoFocus
              onChange={(e) => setKey(e.target.value)}
            />
            <span
              className="absolute top-1/2 right-3 -translate-y-1/2"
              style={{ color: 'var(--icon-muted)' }}
            >
              <KeyIcon width={14} height={14} />
            </span>
          </div>

          {error && (
            <div
              className="view-enter"
              style={{ fontSize: 'var(--font-size-xs)', color: 'var(--destructive)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="btn-primary flex h-9 cursor-pointer items-center justify-center gap-1.5 outline-none transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {loading && <SpinnerIcon width={14} height={14} />}
            {loading ? '验证中…' : '进入控制台'}
          </button>
        </form>
      </div>
    </div>
  )
}
