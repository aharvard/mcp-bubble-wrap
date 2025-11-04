# Refactoring Notes: OpenAI Apps SDK Architecture

## Overview

The bubble wrap widget has been refactored from a monolithic inline HTML approach to a sophisticated React-based architecture inspired by the [OpenAI Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples).

## Before vs After

### Before: Inline HTML

The original implementation embedded all HTML, CSS, and JavaScript directly in the MCP server:

```typescript
// src/mcp/server.ts
function renderBubbleWrapWidget(bubbleCount: number): string {
  return `<!DOCTYPE html>
<html>
<head>
    <style>
        /* 100+ lines of CSS */
    </style>
</head>
<body>
    <script>
        // 50+ lines of JavaScript
    </script>
</body>
</html>`
}
```

**Problems:**

- No code reusability
- No modern tooling (TypeScript, JSX, linting)
- No hot module replacement during development
- Difficult to maintain complex interactions
- No component composition
- Manual string concatenation for dynamic content

### After: React + Vite Build System

The new implementation separates concerns and uses modern tooling:

```typescript
// src/widgets/bubble-wrap/BubbleWrap.tsx
import { useWidgetProps } from "../../lib/use-widget-props.js"

export function BubbleWrap() {
  const props = useWidgetProps<BubbleWrapProps>({ bubbleCount: 100 })
  // React component logic
}

// src/mcp/server.ts
function loadWidgetHtml(): string {
  return readFileSync("assets/bubble-wrap.html", "utf-8")
}
```

**Benefits:**

- ✅ Modular React components
- ✅ TypeScript type safety
- ✅ Hot module replacement (HMR)
- ✅ Modern animations with Framer Motion
- ✅ Automatic dependency management
- ✅ Production-optimized builds with tree-shaking
- ✅ Asset hashing for cache busting
- ✅ Reusable utility hooks

## Key Architecture Components

### 1. Widget Discovery & Build System

**File**: `scripts/build-widgets.mts`

- Automatically discovers all widgets in `src/widgets/*/index.{tsx,jsx}`
- Bundles each widget independently with Vite
- Generates hashed filenames for cache busting
- Creates standalone HTML files for each widget

**Inspired by**: OpenAI's `build-all.mts`

### 2. Multi-Entry Development Server

**File**: `vite.config.mts`

- Serves all widgets simultaneously during development
- Creates virtual entry points for each widget
- Provides automatic HMR for instant updates
- Serves a gallery page at `http://localhost:4444/`

**Inspired by**: OpenAI's multi-entry dev endpoints pattern

### 3. Widget Props System

**Files**:

- `src/lib/use-openai-global.ts`
- `src/lib/use-widget-props.ts`

Widgets receive props from the Apps SDK via a clean hook interface:

```typescript
const props = useWidgetProps<MyProps>({ defaultValue: 100 })
```

The MCP server passes data through `structuredContent`:

```typescript
return {
    content: [...],
    structuredContent: {
        bubbleCount: validBubbleCount,
    },
};
```

**Inspired by**: OpenAI's `useWidgetProps` pattern

### 4. Asset Management

**Development**: Assets served from Vite dev server (`localhost:4444`)
**Production**: Pre-built assets served from CDN or static server

Environment variable `BASE_URL` controls asset location:

```bash
BASE_URL=https://cdn.example.com npm run build:widgets
```

## Build Process

### Development Build

```bash
npm run dev
```

1. Starts Vite dev server on port 4444
2. Watches `src/widgets/` for changes
3. Provides HMR for instant updates
4. No disk writes needed

### Production Build

```bash
npm run build:widgets
```

1. Discovers all widget entry points
2. For each widget:
   - Bundles React component + dependencies
   - Extracts CSS into separate file
   - Minifies and optimizes
   - Generates content hash
3. Creates HTML files with hashed asset references
4. Outputs to `assets/` directory

### Asset Naming

```
assets/
├── bubble-wrap-92521fc3.js      # Hashed bundle
├── bubble-wrap-92521fc3.css     # Hashed styles
├── bubble-wrap-92521fc3.html    # Hashed HTML
├── bubble-wrap.html              # Latest version pointer
└── bubble-wrap.js.map           # Source map
```

## Creating New Widgets

### 1. Create Widget Directory

```
src/widgets/my-new-widget/
├── MyNewWidget.tsx
├── styles.css
└── index.tsx
```

### 2. Implement Component

```tsx
// MyNewWidget.tsx
import { useWidgetProps } from "../../lib/use-widget-props.js"

interface MyWidgetProps {
  title: string
  count: number
}

export function MyNewWidget() {
  const props = useWidgetProps<MyWidgetProps>({
    title: "Default",
    count: 0,
  })

  return (
    <div className="my-widget">
      <h1>{props.title}</h1>
      <p>Count: {props.count}</p>
    </div>
  )
}
```

### 3. Build & Test

```bash
npm run build:widgets
npm run dev
```

Widget automatically discovered and available at `http://localhost:4444/my-new-widget.html`!

## Best Practices

### Component Structure

- Keep components focused and single-purpose
- Use TypeScript for type safety
- Leverage React hooks for state management
- Use Framer Motion for smooth animations

### Styling

- Scope styles to avoid conflicts
- Use CSS modules for complex widgets
- Leverage CSS variables for theming
- Keep styles in separate `.css` files

### Props

- Define clear TypeScript interfaces
- Provide sensible defaults
- Validate data in the MCP server
- Use `structuredContent` to pass data

### Performance

- Minimize bundle size
- Use dynamic imports for large dependencies
- Optimize images and assets
- Leverage Vite's code splitting

## Migration Path

For existing inline HTML widgets:

1. Extract HTML to React component
2. Convert inline styles to CSS file
3. Add TypeScript types
4. Implement `useWidgetProps` for data
5. Test with MCP Inspector
6. Update MCP server to load built HTML

## Resources

- [OpenAI Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples)
- [Vite Documentation](https://vite.dev)
- [Framer Motion](https://www.framer.com/motion/)
- [Model Context Protocol](https://modelcontextprotocol.io)

## Future Improvements

- [ ] Add Tailwind CSS support
- [ ] Implement widget testing framework
- [ ] Add widget preview/screenshot generation
- [ ] Create widget template CLI tool
- [ ] Add TypeScript strict mode
- [ ] Implement widget versioning system
