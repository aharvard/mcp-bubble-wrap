/**
 * Space-dust burst rendered on a single fixed, pointer-transparent canvas.
 *
 * Call `burst(x, y, radius)` (viewport coordinates) through the ref whenever a
 * bubble pops. Particles fly outward with drag, drift gently, twinkle and
 * fade. The animation loop only runs while particles are alive, and nothing is
 * drawn when the user prefers reduced motion.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react"

export interface PopParticlesHandle {
  burst: (x: number, y: number, radius: number) => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  age: number
  life: number
  twinkle: number
  tint: [number, number, number]
}

// Monochrome dust: medium-light grey on dark backgrounds, medium-dark grey on
// light ones, so it reads as dust rather than sparks in either theme.
const DARK_TINT: [number, number, number] = [176, 178, 186]
const LIGHT_TINT: [number, number, number] = [104, 106, 116]

const canvasStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  zIndex: 40,
}

function isDark() {
  return document.documentElement.classList.contains("dark")
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  )
}

export const PopParticles = forwardRef<PopParticlesHandle>(
  function PopParticles(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const particles = useRef<Particle[]>([])
    const frame = useRef<number | null>(null)
    const lastTime = useRef<number>(0)

    // Keep the backing store in sync with the viewport and device pixel ratio.
    // Sized lazily as well as on resize: the widget may mount while its iframe
    // is hidden or 0x0 (background tab, host still laying out), in which case a
    // mount-time measurement would stick at zero.
    const ensureSize = () => {
      const canvas = canvasRef.current
      if (!canvas) return false
      const dpr = window.devicePixelRatio || 1
      const width = Math.ceil(window.innerWidth * dpr)
      const height = Math.ceil(window.innerHeight * dpr)
      if (width === 0 || height === 0) return false
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      return true
    }

    useEffect(() => {
      ensureSize()
      window.addEventListener("resize", ensureSize)
      return () => window.removeEventListener("resize", ensureSize)
    }, [])

    useEffect(() => {
      return () => {
        if (frame.current !== null) cancelAnimationFrame(frame.current)
      }
    }, [])

    const tick = (now: number) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (!canvas || !ctx) return
      if (!ensureSize()) {
        // Nothing to draw into yet; try again next frame.
        frame.current = requestAnimationFrame(tick)
        return
      }

      const dt = Math.min(48, now - (lastTime.current || now)) / 1000
      lastTime.current = now

      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = isDark() ? "lighter" : "source-over"

      // Dust
      particles.current = particles.current.filter((p) => p.age < p.life)
      for (const p of particles.current) {
        p.age += dt
        const t = p.age / p.life
        // Drag, then a slow drift so the dust seems to float once it loses speed
        const drag = Math.pow(0.08, dt)
        p.vx *= drag
        p.vy *= drag
        p.vy -= 6 * dt // barely-there lift
        p.x += p.vx * dt
        p.y += p.vy * dt
        const fade = 1 - t * t
        const twinkle = 0.65 + 0.35 * Math.sin(now / 90 + p.twinkle)
        const alpha = Math.max(0, fade * twinkle)
        const [r, g, b] = p.tint
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.fill()
      }

      if (particles.current.length > 0) {
        frame.current = requestAnimationFrame(tick)
      } else {
        frame.current = null
        lastTime.current = 0
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }

    useImperativeHandle(ref, () => ({
      burst(x, y, radius) {
        if (prefersReducedMotion()) return
        const tint = isDark() ? DARK_TINT : LIGHT_TINT
        const count = Math.round(30 + radius * 0.7)
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          // Spawn on the rim of the bubble (just inside to just outside it) and
          // fly radially outward, so the dust is a shell breaking apart rather
          // than a burst from a single point.
          const startR = radius * (0.85 + Math.random() * 0.3)
          const speed = radius * (1.6 + Math.random() * 3.2)
          const jitter = radius * 0.6
          particles.current.push({
            x: x + Math.cos(angle) * startR,
            y: y + Math.sin(angle) * startR,
            vx: Math.cos(angle) * speed + (Math.random() - 0.5) * jitter,
            vy: Math.sin(angle) * speed + (Math.random() - 0.5) * jitter,
            size: 0.3 + Math.random() * 0.9,
            age: 0,
            life: 0.7 + Math.random() * 0.9,
            twinkle: Math.random() * Math.PI * 2,
            tint,
          })
        }
        if (frame.current === null) {
          lastTime.current = 0
          frame.current = requestAnimationFrame(tick)
        }
      },
    }))

    return <canvas ref={canvasRef} style={canvasStyle} aria-hidden="true" />
  }
)

export default PopParticles
