/**
 * "Sheet finished" overlay. The board behind it is blurred by BubbleWrap; this
 * component only lays its content directly over that blur: a waving headline,
 * a few stats, and a form to start another sheet with a chosen bubble count.
 */

import { useMemo, useState, type FormEvent } from "react"
import { BubbleCountStepper } from "./BubbleCountStepper"

const HEADLINES = [
  "Pop-tastic!",
  "Every. Last. One.",
  "Fully decompressed",
  "Pop star!",
  "Sheet: obliterated",
  "Ahh, that's better",
]

const SUBLINES = [
  "Your stress has left the building.",
  "Not a single bubble survived.",
  "Scientists call this peak satisfaction.",
  "The bubbles never stood a chance.",
  "Ten out of ten, would pop again.",
]

export const MIN_BUBBLES = 1
export const MAX_BUBBLES = 500

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function formatSeconds(ms: number) {
  const s = ms / 1000
  return s < 60
    ? `${s.toFixed(1)}s`
    : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

export interface CompletionCardProps {
  bubbleCount: number
  /** Time from first to last pop, if we saw the whole sheet being popped. */
  elapsedMs: number | null
  /** Start another sheet with the given number of bubbles. */
  onNewSheet: (bubbleCount: number) => void
  busy: boolean
}

export function CompletionCard({
  bubbleCount,
  elapsedMs,
  onNewSheet,
  busy,
}: CompletionCardProps) {
  // Chosen once per completion (the overlay remounts for each finished sheet).
  const [headline, subline] = useMemo(
    () => [pick(HEADLINES), pick(SUBLINES)],
    []
  )
  // Defaults to the size of the sheet that was just finished.
  const [count, setCount] = useState(String(bubbleCount))

  const parsed = Math.floor(Number(count))
  const valid =
    Number.isFinite(parsed) && parsed >= MIN_BUBBLES && parsed <= MAX_BUBBLES

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid && !busy) onNewSheet(parsed)
  }

  const stats: { value: string; label: string }[] = [
    { value: String(bubbleCount), label: "popped" },
  ]
  if (elapsedMs !== null && elapsedMs > 0) {
    stats.push({ value: formatSeconds(elapsedMs), label: "flat" })
    stats.push({
      value: (bubbleCount / (elapsedMs / 1000)).toFixed(1),
      label: "pops / sec",
    })
  }

  return (
    <div
      className="bw-complete fixed inset-0 z-30 flex flex-col items-center justify-center px-4 text-center"
      role="dialog"
      aria-live="polite"
      aria-label="Sheet complete"
    >
      <h2 className="bw-complete-headline text-3xl font-extrabold tracking-tight bw-strong">
        {Array.from(headline).map((char, i) => (
          <span key={i} style={{ animationDelay: `${i * 35}ms` }}>
            {char === " " ? " " : char}
          </span>
        ))}
      </h2>
      <p className="mt-1 text-sm bw-muted">{subline}</p>

      <div className="mt-4 flex justify-center gap-2">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="bw-complete-stat rounded-xl px-3 py-1.5"
            style={{ animationDelay: `${300 + i * 80}ms` }}
          >
            <div className="text-base font-bold bw-strong leading-tight">
              {stat.value}
            </div>
            <div className="text-[10px] uppercase tracking-wide bw-muted">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="bw-complete-form mt-5 flex flex-wrap items-center justify-center gap-3"
      >
        <label className="sr-only" htmlFor="bw-next-count">
          Number of bubbles
        </label>
        <BubbleCountStepper
          id="bw-next-count"
          value={count}
          onChange={setCount}
          min={MIN_BUBBLES}
          max={MAX_BUBBLES}
          fallback={bubbleCount}
          invalid={!valid}
        />
        <button
          type="submit"
          disabled={busy || !valid}
          className="bw-complete-button bw-accent-button rounded-full px-5 py-2.5 text-base font-semibold"
        >
          {busy ? "Inflating…" : "Pop another sheet"}
        </button>
      </form>
    </div>
  )
}

export default CompletionCard
