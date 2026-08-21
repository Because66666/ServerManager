// useDelayedUnmount.ts: 弹窗延迟卸载 hook——open 变 false 后保持渲染并进入 closing 态，
// 待退场动画播完再真正卸载，实现与打开动画对称的关闭逆动画
import { useEffect, useState } from 'react'

interface ModalTransition {
  /** 是否仍需渲染（含关闭动画期间） */
  render: boolean
  /** 是否处于关闭动画阶段 */
  closing: boolean
}

export function useDelayedUnmount(open: boolean, duration = 240): ModalTransition {
  const [render, setRender] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      setClosing(false)
      return
    }
    setClosing(true)
    const timer = setTimeout(() => {
      setRender(false)
      setClosing(false)
    }, duration)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, duration])

  return { render, closing }
}
