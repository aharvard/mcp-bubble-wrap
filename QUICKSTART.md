# Quick Start Guide

## What Changed?

Your bubble wrap widget has been refactored to use a modern React + Vite architecture inspired by the OpenAI Apps SDK examples. Instead of inline HTML strings, you now have:

- ✅ **React components** with TypeScript
- ✅ **Framer Motion animations**
- ✅ **Hot Module Replacement** for instant dev updates
- ✅ **Optimized production builds** with asset hashing
- ✅ **Multi-widget support** - easily add more widgets

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build the Widget

```bash
pnpm run build:widgets
```

This generates optimized assets in the `assets/` directory.

### 3. Build the Server

```bash
pnpm run build:server
```

This compiles the TypeScript MCP server.

### 4. Start the Server

```bash
pnpm start
```

Or for development with auto-reload:

```bash
pnpm dev
```

## Development Workflow

### Full Development Mode

```bash
pnpm dev
```

This starts:

1. **Vite dev server** (port 4444) with HMR
2. **MCP server** with auto-reload
3. **MCP Inspector** for testing

**Widget gallery**: http://localhost:4444/

### Widget-Only Development

If you're just working on the widget UI:

```bash
pnpm run dev:widgets
```

Then visit http://localhost:4444/bubble-wrap.html

### Testing with MCP Inspector

```bash
pnpm inspect:dev
```

This opens an interactive UI where you can:

- Test the `bubble_wrap` tool
- See the widget render in real-time
- Inspect the MCP protocol messages

## Project Structure

```
src/
├── widgets/
│   └── bubble-wrap/
│       ├── BubbleWrap.tsx     # Main React component
│       ├── styles.css          # Widget styles
│       └── index.tsx           # Entry point
├── lib/
│   ├── use-widget-props.ts    # Hook for receiving props from MCP
│   └── use-openai-global.ts   # Hook for Apps SDK data
├── mcp/
│   └── server.ts               # MCP server (loads built HTML)
└── index.ts                    # Server entry point

scripts/
└── build-widgets.mts           # Widget build orchestrator

assets/                         # Generated build output
├── bubble-wrap-92521fc3.js     # Hashed JS bundle
├── bubble-wrap-92521fc3.css    # Hashed CSS bundle
└── bubble-wrap.html            # HTML entry point
```

## Adding a New Widget

### 1. Create the Structure

```bash
mkdir -p src/widgets/my-widget
```

### 2. Create Component Files

**`src/widgets/my-widget/MyWidget.tsx`**:

```tsx
import { useWidgetProps } from "../../lib/use-widget-props.js"

interface MyWidgetProps {
  message?: string
}

export function MyWidget() {
  const props = useWidgetProps<MyWidgetProps>({ message: "Hello!" })

  return (
    <div className="my-widget">
      <h1>{props.message}</h1>
    </div>
  )
}

export default MyWidget
```

**`src/widgets/my-widget/styles.css`**:

```css
.my-widget {
  padding: 20px;
  font-family: system-ui;
}
```

**`src/widgets/my-widget/index.tsx`**:

```tsx
import { createRoot } from "react-dom/client"
import MyWidget from "./MyWidget"
import "./styles.css"

const rootEl = document.getElementById("my-widget-root")
if (rootEl) {
  createRoot(rootEl).render(<MyWidget />)
}

export { MyWidget }
export default MyWidget
```

### 3. Build & Test

```bash
pnpm run build:widgets
pnpm run dev:widgets
```

Visit: http://localhost:4444/my-widget.html

### 4. Add MCP Tool (Optional)

In `src/mcp/server.ts`, register a new tool that serves your widget:

```typescript
server.registerTool(
  "my_widget",
  {
    title: "My Widget",
    description: "Does something cool",
    inputSchema: {
      message: z.string().describe("Message to display"),
    },
    _meta: {
      "openai/outputTemplate": "ui://widgets/my-widget",
    },
  },
  async ({ message }) => {
    // Load the built HTML
    const html = readFileSync("assets/my-widget.html", "utf-8")

    return {
      content: [
        { type: "text", text: "Widget created!" },
        createUIResource({
          uri: "ui://widgets/my-widget",
          encoding: "text",
          content: { type: "rawHtml", htmlString: html },
        }),
      ],
      structuredContent: { message },
    }
  }
)
```

## Production Deployment

### Build for Production

```bash
# Set your production asset URL
BASE_URL=https://your-cdn.com npm run build
```

This:

1. Builds the server → `dist/`
2. Builds widgets → `assets/`
3. Injects `BASE_URL` into widget HTML

### Deploy

1. Upload `dist/` to your server
2. Upload `assets/` to your CDN
3. Start: `node dist/index.js`

### Environment Variables

- `BASE_URL` - Where widget assets are hosted (default: `http://localhost:4444`)
- `PORT` - Server port (optional)

## Troubleshooting

### Widgets not loading in production

Make sure `BASE_URL` matches where your assets are actually hosted:

```bash
BASE_URL=https://cdn.example.com npm run build:widgets
```

### TypeScript errors in widgets

The widget code is excluded from the main `tsconfig.json`. Vite handles TypeScript compilation for widgets during build.

### HMR not working

Make sure the Vite dev server is running on port 4444:

```bash
pnpm run dev:widgets
```

### Widget shows blank in ChatGPT

1. Check that assets are accessible from the `BASE_URL`
2. Verify CSP settings in the MCP server
3. Test in MCP Inspector first

## Next Steps

- Read `REFACTORING_NOTES.md` for detailed architecture explanation
- Check out the [OpenAI Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples) for more widget ideas
- Experiment with Framer Motion for animations
- Add more interactive widgets!

## Resources

- **MCP Docs**: https://modelcontextprotocol.io
- **Vite Docs**: https://vite.dev
- **React Docs**: https://react.dev
- **Framer Motion**: https://www.framer.com/motion/

Happy coding! 🚀
