// icons.tsx: 内联 SVG 图标集合（统一 stroke 风格）
import type { SVGProps } from 'react'

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

export const ServerIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="2" y="3" width="20" height="7" rx="2" />
    <rect x="2" y="14" width="20" height="7" rx="2" />
    <circle cx="6.5" cy="6.5" r="0.5" fill="currentColor" />
    <circle cx="6.5" cy="17.5" r="0.5" fill="currentColor" />
  </Svg>
)

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)

export const StopIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
  </Svg>
)

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
)

export const LogoutIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </Svg>
)

export const RefreshIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
  </Svg>
)

export const TerminalIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 17l6-5-6-5" />
    <path d="M12 19h8" />
  </Svg>
)

export const KeyIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.7 12.3 21 2M15 8l3 3" />
  </Svg>
)

export const AlertIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </Svg>
)

export const SpinnerIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p} className={`animate-spin ${p.className ?? ''}`}>
    <path d="M21 12a9 9 0 1 1-6.2-8.56" />
  </Svg>
)
