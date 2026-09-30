import {
  DISPLAY_MODE_LABELS,
  type DisplayMode,
} from "../../shared/display-modes"
import { useDisplayMode } from "../hooks/use-display-mode"

/**
 * Renders one button per display mode the host offers (other than the
 * current one), e.g. Goose's split-right / split-bottom. Hidden until the host
 * has told us which modes are available, so unsupported modes never appear.
 *
 * The group is fixed to the bottom of the viewport and floats above the
 * content, so it stays reachable even when the viewport is shorter than the
 * bubble grid and the user has to scroll. In inline mode the iframe is sized
 * to the content, so "viewport bottom" is simply the bottom of the widget.
 */
export function DisplayModeControls({
  className = "",
}: {
  className?: string
}) {
  const { displayMode, availableDisplayModes, requestDisplayMode } =
    useDisplayMode()

  const targets = availableDisplayModes.filter((mode) => mode !== displayMode)
  if (targets.length === 0) return null

  const handleClick = async (mode: DisplayMode) => {
    try {
      const granted = await requestDisplayMode(mode)
      console.log(
        `[DisplayModeControls] requested ${mode}, host set ${granted}`
      )
    } catch (error) {
      console.error(`[DisplayModeControls] Error requesting ${mode}:`, error)
    }
  }

  return (
    <div
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] ${className}`}
      role="group"
      aria-label="Display mode"
      data-display-mode={displayMode}
    >
      {targets.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => handleClick(mode)}
          className="bw-control-button w-9 h-9 shadow-md hover:shadow-lg rounded-full transition-all flex items-center justify-center"
          aria-label={`Enter ${DISPLAY_MODE_LABELS[mode].toLowerCase()}`}
          title={DISPLAY_MODE_LABELS[mode]}
        >
          <DisplayModeIcon mode={mode} />
        </button>
      ))}
    </div>
  )
}

function DisplayModeIcon({ mode }: { mode: DisplayMode }) {
  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "w-4 h-4",
    "aria-hidden": true,
  }

  switch (mode) {
    case "inline":
      return (
        <svg {...common}>
          <line x1="4" y1="5" x2="20" y2="5" />
          <rect x="4" y="9" width="16" height="6" rx="1.5" />
          <line x1="4" y1="19" x2="20" y2="19" />
        </svg>
      )
    case "fullscreen":
      return (
        <svg {...common}>
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      )
    case "pip":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="16" height="12" rx="2" />
          <rect x="14" y="14" width="8" height="8" rx="2" />
        </svg>
      )
    case "split-right":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="14" y1="4" x2="14" y2="20" />
          <rect
            x="14"
            y="4"
            width="7"
            height="16"
            fill="currentColor"
            stroke="none"
            opacity="0.3"
          />
        </svg>
      )
    case "split-bottom":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="14" x2="21" y2="14" />
          <rect
            x="3"
            y="14"
            width="18"
            height="6"
            fill="currentColor"
            stroke="none"
            opacity="0.3"
          />
        </svg>
      )
    case "standalone":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="13" height="13" rx="2" />
          <path d="M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3" />
        </svg>
      )
  }
}

export default DisplayModeControls
