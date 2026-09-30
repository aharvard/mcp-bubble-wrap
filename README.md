# MCP Bubble Wrap

A sophisticated MCP (Model Context Protocol) server with React-based interactive widgets, inspired by the [OpenAI Apps SDK examples](https://github.com/openai/openai-apps-sdk-examples).

## Features

- 🫧 **Interactive Bubble Wrap Widget**: Pop virtual bubbles with smooth CSS animations
- ⚡ **Modern Build System**: Vite-powered development and production builds
- 🎨 **React-based Widgets**: Easy to create and maintain UI components
- 🎨 **Tailwind CSS**: Utility-first CSS framework with theme support
- 🔄 **Hot Module Replacement**: Fast development with instant updates
- 📦 **Optimized Builds**: Inlined assets for easy deployment
- 🌐 **Apps SDK Compatible**: Works seamlessly with ChatGPT and OpenAI Apps SDK
- 🧩 **MCP Apps (SEP-1865)**: Native support for MCP Apps hosts such as Goose via `@modelcontextprotocol/ext-apps`
- 🪟 **Display modes**: Declares inline, fullscreen, pip, plus Goose's split-right, split-bottom and standalone

## Project Structure

```
mcp-bubble-wrap/
├── src/
│   ├── shared/
│   │   └── display-modes.ts    # Display modes shared by server + widgets
│   ├── widgets/                # React-based widgets
│   │   ├── styles.css          # Shared Tailwind styles
│   │   ├── components/         # Shared widget components
│   │   │   ├── DisplayModeControls.tsx
│   │   │   └── Layout.tsx
│   │   ├── hooks/              # Shared hooks
│   │   │   ├── types.ts
│   │   │   ├── use-display-mode.ts   # Host-agnostic display mode state
│   │   │   ├── use-mcp-app.ts        # MCP Apps (ext-apps) connection
│   │   │   └── use-openai-global.ts  # ChatGPT (OpenAI Apps SDK) globals
│   │   └── bubble-wrap/
│   │       ├── BubbleWrap.tsx  # Widget component
│   │       ├── index.tsx       # Widget entry point
│   │       └── types.ts        # Widget types
│   ├── utils/                  # Shared utilities
│   │   ├── load-widget-html.ts
│   │   └── logger.ts
│   ├── mcp-server.ts           # /mcp route: OpenAI Apps SDK + mcp-ui
│   ├── mcp-app-server.ts       # /mcp-app route: MCP Apps (SEP-1865)
│   └── index.ts                # Server entry point
├── build-widgets.mts           # Widget build orchestrator
├── assets/                     # Built widget assets (generated)
├── dist/                       # Compiled server code (generated)
├── vite.config.mts             # Vite configuration for dev/build
├── tailwind.config.mjs         # Tailwind CSS configuration
├── postcss.config.mjs          # PostCSS configuration
└── package.json
```

## Setup

Requires **Node.js 20+** (the MCP TypeScript SDK v2 packages need it). An `.nvmrc` is included.

```bash
pnpm install
```

## Development

### Start Everything

Run the complete development stack with hot reloading:

```bash
pnpm dev
```

This starts:

1. **Widget Dev Server** (port 4444) - Vite dev server with HMR
2. **MCP Server** (port 5678) - TypeScript server with vite-node
3. **MCP Inspector** - Interactive testing UI

### Individual Commands

```bash
# Widget development only
pnpm dev:widgets

# Build widgets
pnpm build:widgets

# Type-check server and widgets
pnpm typecheck

# Build server
pnpm build:server

# Serve built widgets
pnpm serve:widgets
```

## Build

Build both the server and widgets for production:

```bash
pnpm build
```

This will:

1. Compile TypeScript server code to `dist/`
2. Bundle React widgets to `assets/` with hashed filenames
3. Generate HTML files for each widget

### Environment Variables

- `BASE_URL` - Base URL for widget assets in HTML generation (default: `http://localhost:5678`)
  - Note: Not currently used as assets are inlined in HTML
  - For production, set this to your deployed assets URL if serving external resources
- `PORT` - MCP server port (default: `5678`)

Example:

```bash
BASE_URL=https://your-cdn.com pnpm run build:widgets
PORT=3000 pnpm start
```

## Production

```bash
pnpm start
```

## Creating New Widgets

1. Create a new directory under `src/widgets/`:

```
src/widgets/my-widget/
├── MyWidget.tsx    # React component
└── index.tsx       # Entry point (imports shared styles.css)
```

2. Entry point template (`index.tsx`):

```tsx
import { createRoot } from "react-dom/client"
import MyWidget from "./MyWidget"

const rootEl = document.getElementById("my-widget-root")
if (rootEl) {
  createRoot(rootEl).render(<MyWidget />)
}

export { MyWidget }
export default MyWidget
```

3. Widget component template (`MyWidget.tsx`):

```tsx
import { useOpenAiGlobal } from "../hooks/use-openai-global.js"
import { Layout } from "../components/Layout.js"

interface MyWidgetProps {
  // Your props from the MCP tool
  message?: string
}

export function MyWidget() {
  // Get the structured content passed from the MCP tool
  const toolOutput = useOpenAiGlobal("toolOutput") as MyWidgetProps

  return (
    <Layout>
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {toolOutput?.message || "Hello World"}
        </h1>
      </div>
    </Layout>
  )
}

export default MyWidget
```

4. Build and test:

```bash
pnpm build:widgets
pnpm dev
```

The widget will automatically be discovered and built!

### Styling with Tailwind CSS

All widgets have access to Tailwind CSS utility classes. The `Layout` component automatically handles:

- **Theme detection**: Automatically detects and applies theme from OpenAI global data
- **Layout constraints**: Reports size changes to parent window
- **Responsive design**: Full Tailwind responsive utilities available

Example styling:

```tsx
<div className="flex items-center justify-center min-h-[200px]">
  <p className="text-gray-500 animate-pulse">Loading...</p>
</div>
```

## Widget Gallery

During development, visit `http://localhost:4444` to see all available widgets.

## MCP Inspector

The MCP Inspector provides an interactive UI for testing your MCP server:

```bash
# Development mode (connects to local server)
pnpm inspect:dev

# Production mode
pnpm inspect:prod
```

## Architecture

### Widget Build System

The build system is inspired by the OpenAI Apps SDK examples:

1. **Discovery**: Automatically finds all `src/widgets/**/index.{tsx,jsx}` files
2. **Bundling**: Each widget is bundled as a standalone module with Vite
3. **Hashing**: Assets are versioned with content hashes for cache busting
4. **HTML Generation**: Creates standalone HTML files that can be served directly

### MCP Server Integration

The server exposes the same widget on two Streamable HTTP routes:

| Route      | Protocol                                               | Typical host                |
| ---------- | ------------------------------------------------------ | --------------------------- |
| `/mcp`     | OpenAI Apps SDK + mcp-ui (`@mcp-ui/server`)            | ChatGPT                     |
| `/mcp-app` | MCP Apps / SEP-1865 (`@modelcontextprotocol/ext-apps`) | Goose, other MCP Apps hosts |

Both routes load the built widget HTML from `assets/`. The `/mcp-app` route
registers the UI resource and tool with `registerAppResource` /
`registerAppTool` from the ext-apps server helpers, which emit the
`text/html;profile=mcp-app` MIME type and `_meta.ui` metadata for you.

### Display Modes

The widget declares every display mode it can render in through the MCP Apps
`ui/initialize` handshake (`appCapabilities.availableDisplayModes`). The list
lives in `src/shared/display-modes.ts`:

| Mode           | Source          |
| -------------- | --------------- |
| `inline`       | MCP Apps spec   |
| `fullscreen`   | MCP Apps spec   |
| `pip`          | MCP Apps spec   |
| `split-right`  | Goose extension |
| `split-bottom` | Goose extension |
| `standalone`   | Goose extension |

The three Goose modes are not part of the MCP Apps spec; Goose accepts them
and other hosts ignore them. At runtime the widget renders one control per
mode the host actually offers (`DisplayModeControls`), so the split-right /
split-bottom buttons only appear under a host that advertises them. The
controls are fixed to the bottom of the viewport so they stay reachable when
the grid is taller than the viewport. In ChatGPT the controls fall back to
`window.openai.requestDisplayMode` with the three spec modes.

**Non-spec modes and the ext-apps SDK.** The `App` class in
`@modelcontextprotocol/ext-apps` validates every host message against the spec
schemas, whose display-mode enum is exactly `inline | fullscreen | pip`. A host
that puts `split-right` in `hostContext.availableDisplayModes` would otherwise
make `App.connect()` reject the whole `ui/initialize` result.
`src/widgets/lib/display-mode-compat-transport.ts` wraps the
`PostMessageTransport`, records the real values the host sent, and hands the
SDK a spec-conformant copy. `useDisplayMode()` reads the real values from that
side channel and falls back to `hostContext` for spec-only hosts.

### Theme and Layout

- **Theme** comes from the host (`window.openai.theme` in ChatGPT,
  `hostContext.theme` in MCP Apps hosts, updated via
  `ui/notifications/host-context-changed`) and falls back to
  `prefers-color-scheme`. `Layout` applies it to `<html>` as the `dark` class
  plus `data-theme`; colours are CSS variables in `src/widgets/styles.css`.
- **Scrolling** is disabled only in `inline` mode, where the host sizes the
  iframe to the content. Every other mode gives the app a fixed viewport, so
  the document scrolls normally there.
- **Grid sizing** (`useBubbleLayout`) derives the column count and bubble size
  from the measured container width. Outside `inline` mode it also tries to
  pick the largest bubble size at which every bubble fits the viewport height,
  so fullscreen and split modes usually need no scrolling at all.
- The resource sets `prefersBorder: false` and the app paints a full-bleed
  background, so the host draws no frame around it.

### Props Communication

Widgets receive data via the OpenAI global object:

```tsx
// In your widget - access toolOutput from OpenAI globals
const toolOutput = useOpenAiGlobal("toolOutput") as MyProps

// The server passes data via structuredContent
return {
  structuredContent: {
    bubbleCount: validBubbleCount,
  },
}

// This structuredContent becomes available as toolOutput in the widget
```

## Deployment

### Render.com

The project includes a `render.yaml` for easy deployment to Render:

1. Push your code to GitHub
2. Connect your repository to Render
3. Set environment variables:
   - `BASE_URL`: URL where your assets will be served

### Custom Deployment

1. Build the project:

```bash
pnpm run build
```

2. Deploy:
   - Upload `dist/` directory to your server
   - Upload `assets/` directory (HTML files with inlined JS/CSS)
   - Start the server: `node dist/index.js`
   - Server will run on port 5678 by default (configure with `PORT` env var)

## Dependencies

### Runtime

- `react` & `react-dom`: UI framework
- `@modelcontextprotocol/server` / `@modelcontextprotocol/node`: MCP TypeScript SDK v2 (server + Node Streamable HTTP transport)
- `@modelcontextprotocol/ext-apps`: MCP Apps (SEP-1865) server helpers and the widget-side `App` client
- `@modelcontextprotocol/client` / `@modelcontextprotocol/core`: peer packages required by ext-apps in the widget bundle
- `@mcp-ui/server`: mcp-ui resource creation with the OpenAI Apps SDK adapter (used by the `/mcp` route)
- `express`: HTTP server for MCP protocol
- `cors`: CORS middleware
- `zod`: Schema validation
- `chalk`: Terminal colors and logging

### Development

- `vite`: Build tool and dev server
- `@vitejs/plugin-react`: React support for Vite
- `tsx`: TypeScript execution
- `vite-node`: Run TypeScript server with hot reload
- `fast-glob`: File discovery for build system
- `tailwindcss`: Utility-first CSS framework
- `postcss`: CSS transformation tool
- `autoprefixer`: Automatic vendor prefix handling
- `concurrently`: Run multiple commands in parallel
- `prettier`: Code formatting

## Inspiration

This project structure is heavily inspired by the excellent [OpenAI Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples), particularly their approach to:

- Widget build orchestration
- Multi-entry point development
- Asset hashing and versioning
- Development server setup

## License

MIT
