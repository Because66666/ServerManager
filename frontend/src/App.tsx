// App.tsx: 应用根组件——登录态管理（登录页 / 仪表盘视图切换，带 CSS 入场动画）
import { useCallback, useEffect, useState } from 'react'
import { api, clearToken, getToken, UNAUTHORIZED_EVENT } from './api'
import Login from './views/Login'
import Dashboard from './views/Dashboard'

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => !!getToken())

  // 会话失效（401）时自动回到登录页
  useEffect(() => {
    const onUnauthorized = () => setAuthed(false)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const handleLogin = useCallback(() => setAuthed(true), [])

  const handleLogout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // 登出失败也直接清空本地会话
    }
    clearToken()
    setAuthed(false)
  }, [])

  return authed ? (
    <Dashboard key="dashboard" onLogout={handleLogout} />
  ) : (
    <Login key="login" onLogin={handleLogin} />
  )
}
