import { useState, useEffect } from 'react'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
}

function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.sm) return 'xs'
  if (width < BREAKPOINTS.md) return 'sm'
  if (width < BREAKPOINTS.lg) return 'md'
  if (width < BREAKPOINTS.xl) return 'lg'
  return 'xl'
}

export function useResponsive() {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  )

  useEffect(() => {
    let raf: number
    const handler = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setWidth(window.innerWidth))
    }
    window.addEventListener('resize', handler, { passive: true })
    return () => {
      window.removeEventListener('resize', handler)
      cancelAnimationFrame(raf)
    }
  }, [])

  const bp = getBreakpoint(width)

  return {
    width,
    bp,
    isMobile:  width < BREAKPOINTS.md,   // < 768px
    isTablet:  width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,

    // Responsive grid helper: returns CSS gridTemplateColumns string
    // cols({ xs: 1, sm: 1, md: 2, lg: 3 })
    cols: (map: Partial<Record<Breakpoint, number>>): string => {
      const order: Breakpoint[] = ['xl', 'lg', 'md', 'sm', 'xs']
      for (const b of order) {
        if (b === bp || (BREAKPOINTS[b] <= width && map[b] !== undefined)) {
          const n = map[b]
          if (n !== undefined) return `repeat(${n}, 1fr)`
        }
      }
      // Fallback: find the largest defined breakpoint that fits
      for (const b of order) {
        if (map[b] !== undefined && BREAKPOINTS[b] <= width) {
          return `repeat(${map[b]}, 1fr)`
        }
      }
      return `repeat(${Object.values(map)[0] ?? 1}, 1fr)`
    },
  }
}
