/**
 * Minus / value / plus stepper for choosing the next sheet's bubble count.
 *
 * - Buttons step in tiers: by 1 below 10, by 5 from 10 to 50, by 10 above 50.
 *   Steps land on multiples of the tier size (24 → 25 or 20), so round numbers
 *   are quick to reach; press and hold to repeat, speeding up as you hold.
 * - The value is a plain text field: click it to type an exact number. Arrow
 *   keys step by 1, Shift+arrows step like the buttons.
 * - Buttons disable themselves at the bounds.
 */

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react"

/**
 * Step size for the buttons. Going up, the tier is chosen by the current
 * value; going down, by the value we'd land in, so the boundaries are
 * symmetric: 9 ⇄ 10 by 1, 45 ⇄ 50 by 5, 50 ⇄ 60 by 10.
 */
export function tierStep(value: number, direction: 1 | -1): number {
  if (direction > 0) return value < 10 ? 1 : value < 50 ? 5 : 10
  return value <= 10 ? 1 : value <= 50 ? 5 : 10
}

export interface BubbleCountStepperProps {
  /** Raw field text, so a half-typed value isn't clobbered. */
  value: string
  onChange: (value: string) => void
  min: number
  max: number
  /** Value to step from when the field doesn't hold a number. */
  fallback: number
  invalid?: boolean
  id?: string
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function BubbleCountStepper({
  value,
  onChange,
  min,
  max,
  fallback,
  invalid,
  id,
}: BubbleCountStepperProps) {
  const parsed = Math.floor(Number(value))
  const current =
    Number.isFinite(parsed) && value.trim() !== "" ? parsed : fallback

  // Latest value for the hold-to-repeat timer, which outlives renders.
  const currentRef = useRef(current)
  currentRef.current = current
  const repeatTimer = useRef<number | null>(null)

  // Land on the next multiple of the step size in the given direction.
  const stepFrom = (from: number, direction: 1 | -1, size: number) => {
    const next =
      direction > 0
        ? Math.floor(from / size) * size + size
        : Math.ceil(from / size) * size - size
    return clamp(next, min, max)
  }

  /** `size` omitted means use the tiered button step. */
  const step = (direction: 1 | -1, size?: number) => {
    const from = currentRef.current
    const next = stepFrom(from, direction, size ?? tierStep(from, direction))
    currentRef.current = next
    onChange(String(next))
  }

  const stopRepeat = () => {
    if (repeatTimer.current !== null) {
      window.clearTimeout(repeatTimer.current)
      repeatTimer.current = null
    }
  }
  useEffect(() => stopRepeat, [])

  const startRepeat = (direction: 1 | -1) => (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    stopRepeat()
    step(direction)
    let delay = 380
    const tick = () => {
      step(direction)
      delay = Math.max(45, delay * 0.8)
      repeatTimer.current = window.setTimeout(tick, delay)
    }
    repeatTimer.current = window.setTimeout(tick, delay)
  }

  // Keyboard activation of the buttons (Enter / Space) arrives as a click with
  // detail 0; pointer presses are handled by startRepeat instead.
  const keyboardStep = (direction: 1 | -1) => (event: { detail: number }) => {
    if (event.detail === 0) step(direction)
  }

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
    event.preventDefault()
    step(event.key === "ArrowUp" ? 1 : -1, event.shiftKey ? undefined : 1)
  }

  const holdHandlers = {
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onPointerCancel: stopRepeat,
  }

  return (
    <div
      className={`bw-stepper inline-flex items-center rounded-full p-1 ${invalid ? "bw-stepper-invalid" : ""}`}
    >
      <button
        type="button"
        className="bw-stepper-button"
        aria-label="Fewer bubbles"
        disabled={current <= min}
        onPointerDown={startRepeat(-1)}
        onClick={keyboardStep(-1)}
        {...holdHandlers}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line x1="6" y1="12" x2="18" y2="12" />
        </svg>
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))
        }
        onKeyDown={onFieldKeyDown}
        onBlur={() => onChange(String(clamp(current, min, max)))}
        className="bw-stepper-value"
        aria-invalid={invalid || undefined}
        aria-describedby={id ? `${id}-hint` : undefined}
      />
      <span id={id ? `${id}-hint` : undefined} className="sr-only">
        {min} to {max} bubbles. Buttons step by 1 below 10, by 5 up to 50, and
        by 10 above 50. Arrow keys change by 1.
      </span>
      <button
        type="button"
        className="bw-stepper-button"
        aria-label="More bubbles"
        disabled={current >= max}
        onPointerDown={startRepeat(1)}
        onClick={keyboardStep(1)}
        {...holdHandlers}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line x1="6" y1="12" x2="18" y2="12" />
          <line x1="12" y1="6" x2="12" y2="18" />
        </svg>
      </button>
    </div>
  )
}

export default BubbleCountStepper
