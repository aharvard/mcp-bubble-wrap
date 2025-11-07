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

## Project Structure

```
mcp-bubble-wrap/
├── src/
│   ├── widgets/                # React-based widgets
│   │   ├── styles.css          # Shared Tailwind styles
│   │   ├── components/         # Shared widget components
│   │   │   └── Layout.tsx
│   │   ├── hooks/              # Shared hooks
│   │   │   ├── types.ts
│   │   │   └── use-openai-global.ts
│   │   └── bubble-wrap/
│   │       ├── BubbleWrap.tsx  # Widget component
│   │       ├── index.tsx       # Widget entry point
│   │       └── types.ts        # Widget types
│   ├── utils/                  # Shared utilities
│   │   └── logger.ts
│   ├── mcp-server.ts           # MCP server implementation
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

The MCP server loads and serves the built widget HTML:

1. Widget HTML is read from the `assets/` directory
2. Passed to the Apps SDK via `createUIResource`
3. Rendered inline in ChatGPT or other Apps SDK clients

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
- `@mcp-ui/server`: MCP UI resource creation
- `@modelcontextprotocol/sdk`: MCP server SDK
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
