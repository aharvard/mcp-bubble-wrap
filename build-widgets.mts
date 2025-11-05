import { build, type InlineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import fg from "fast-glob"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = __dirname

const entries = fg.sync("src/widgets/**/index.{tsx,jsx}", { cwd: rootDir })
const outDir = "assets"

const PER_ENTRY_CSS_GLOB = "**/*.{css,scss,sass}"
const PER_ENTRY_CSS_IGNORE = ["**/*.module.*"]

const builtNames: string[] = []

function wrapEntryPlugin(
  virtualId: string,
  entryFile: string,
  cssPaths: string[]
): Plugin {
  return {
    name: `virtual-entry-wrapper:${entryFile}`,
    resolveId(id) {
      if (id === virtualId) return id
    },
    load(id) {
      if (id !== virtualId) {
        return null
      }

      const cssImports = cssPaths
        .map((css) => `import ${JSON.stringify(css)};`)
        .join("\n")

      return `
    ${cssImports}
    export * from ${JSON.stringify(entryFile)};

    import * as __entry from ${JSON.stringify(entryFile)};
    export default (__entry.default ?? __entry);

    import ${JSON.stringify(entryFile)};
  `
    },
  }
}

// Prepare output directory (wipe on each build)
const outPath = path.join(rootDir, outDir)
if (fs.existsSync(outPath)) {
  console.log("Wiping assets directory...")
  fs.rmSync(outPath, { recursive: true, force: true })
}
fs.mkdirSync(outPath, { recursive: true })
console.log("Created fresh assets directory")

for (const file of entries) {
  const name = path.basename(path.dirname(file))

  const entryAbs = path.resolve(rootDir, file)
  const entryDir = path.dirname(entryAbs)

  // Collect CSS for this entry
  const perEntryCss = fg.sync(PER_ENTRY_CSS_GLOB, {
    cwd: entryDir,
    absolute: true,
    dot: false,
    ignore: PER_ENTRY_CSS_IGNORE,
  })

  const cssToInclude = perEntryCss.filter((p) => fs.existsSync(p))

  const virtualId = `\0virtual-entry:${entryAbs}`

  const createConfig = (): InlineConfig => ({
    plugins: [
      wrapEntryPlugin(virtualId, entryAbs, cssToInclude),
      react(),
      {
        name: "remove-manual-chunks",
        outputOptions(options) {
          if ("manualChunks" in options) {
            delete (options as any).manualChunks
          }
          return options
        },
      },
    ],
    esbuild: {
      jsx: "automatic",
      jsxImportSource: "react",
      target: "es2022",
    },
    build: {
      target: "es2022",
      outDir: outPath,
      emptyOutDir: false,
      chunkSizeWarningLimit: 2000,
      minify: "esbuild",
      sourcemap: false,
      cssCodeSplit: false,
      rollupOptions: {
        input: virtualId,
        output: {
          format: "es",
          entryFileNames: `${name}.js`,
          inlineDynamicImports: true,
          assetFileNames: (info) =>
            (info.name || "").endsWith(".css")
              ? `${name}.css`
              : `[name]-[hash][extname]`,
        },
        preserveEntrySignatures: "allow-extension",
        treeshake: true,
      },
    },
  })

  console.group(`Building ${name} (react)`)
  await build(createConfig())
  console.groupEnd()
  builtNames.push(name)
  console.log(`Built ${name}`)
}

// Determine base URL
const defaultBaseUrl = "http://localhost:5678"
const baseUrlCandidate = process.env.BASE_URL?.trim() ?? ""
const baseUrlRaw =
  baseUrlCandidate.length > 0 ? baseUrlCandidate : defaultBaseUrl
const normalizedBaseUrl = baseUrlRaw.replace(/\/+$/, "") || defaultBaseUrl
console.log(`Using BASE_URL ${normalizedBaseUrl} for generated HTML`)

// Generate HTML files for each widget with inlined assets
for (const name of builtNames) {
  const htmlPath = path.join(outPath, `${name}.html`)

  // Read the built JS and CSS files
  const jsPath = path.join(outPath, `${name}.js`)
  const cssPath = path.join(outPath, `${name}.css`)

  let jsContent = ""
  let cssContent = ""

  if (fs.existsSync(jsPath)) {
    jsContent = fs.readFileSync(jsPath, "utf8")
  }

  if (fs.existsSync(cssPath)) {
    cssContent = fs.readFileSync(cssPath, "utf8")
  }

  const html = `<!doctype html>
<!-- Built: ${new Date().toISOString()} -->
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${cssContent}
  </style>
  <script type="module">
${jsContent}
  </script>
</head>
<body>
  <div id="${name}-root"></div>
</body>
</html>
`
  fs.writeFileSync(htmlPath, html, { encoding: "utf8" })
  console.log(`Generated: ${htmlPath} (with inlined assets)`)

  // Delete the JS and CSS files since they're now inlined in the HTML
  if (fs.existsSync(jsPath)) {
    fs.unlinkSync(jsPath)
    console.log(`Deleted: ${path.basename(jsPath)}`)
  }

  if (fs.existsSync(cssPath)) {
    fs.unlinkSync(cssPath)
    console.log(`Deleted: ${path.basename(cssPath)}`)
  }
}

console.log("\n✅ Widget build complete!")
