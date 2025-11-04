import { build, type InlineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import fg from "fast-glob"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

// Read package.json for version
const pkgPath = path.join(rootDir, "package.json")
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))

const entries = fg.sync("src/widgets/**/index.{tsx,jsx}", { cwd: rootDir })
const outDir = "assets"

const PER_ENTRY_CSS_GLOB = "**/*.{css,scss,sass}"
const PER_ENTRY_CSS_IGNORE = ["**/*.module.*"]

const builtNames: string[] = []

// How many previous builds to keep (for cache overlap)
const KEEP_RECENT_BUILDS = 3

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

// Prepare output directory (don't wipe - we'll keep recent builds)
const outPath = path.join(rootDir, outDir)
fs.mkdirSync(outPath, { recursive: true })

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

// Only hash the freshly built files (without existing hash in name)
const outputs = fs
  .readdirSync(outPath)
  .filter((f) => {
    // Only include .js and .css files
    if (!f.endsWith(".js") && !f.endsWith(".css")) return false

    // Exclude files that already have a hash pattern (widget-12345678.js)
    if (f.match(/-[a-f0-9]{8}\.(js|css)$/)) return false

    // Include unhashed files from this build
    return builtNames.some((name) => f === `${name}.js` || f === `${name}.css`)
  })
  .map((f) => path.join(outPath, f))
  .filter((p) => fs.existsSync(p))

// Create hash from build timestamp for cache busting
const h = crypto
  .createHash("sha256")
  .update(Date.now().toString(), "utf8")
  .digest("hex")
  .slice(0, 8)

console.group("Hashing outputs")
for (const out of outputs) {
  const dir = path.dirname(out)
  const ext = path.extname(out)
  const base = path.basename(out, ext)
  const newName = path.join(dir, `${base}-${h}${ext}`)

  fs.renameSync(out, newName)
  console.log(`${out} -> ${newName}`)
}
console.groupEnd()

console.log("Hash: ", h)

// Determine base URL
const defaultBaseUrl = "http://localhost:5678"
const baseUrlCandidate = process.env.BASE_URL?.trim() ?? ""
const baseUrlRaw =
  baseUrlCandidate.length > 0 ? baseUrlCandidate : defaultBaseUrl
const normalizedBaseUrl = baseUrlRaw.replace(/\/+$/, "") || defaultBaseUrl
console.log(`Using BASE_URL ${normalizedBaseUrl} for generated HTML`)

// Generate HTML files for each widget (unhashed filenames!)
for (const name of builtNames) {
  const unhashedHtmlPath = path.join(outPath, `${name}.html`)
  const html = `<!doctype html>
<!-- Built: ${new Date().toISOString()} -->
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="module" src="${normalizedBaseUrl}/${name}-${h}.js"></script>
  <link rel="stylesheet" href="${normalizedBaseUrl}/${name}-${h}.css">
</head>
<body>
  <div id="${name}-root"></div>
</body>
</html>
`
  fs.writeFileSync(unhashedHtmlPath, html, { encoding: "utf8" })
  console.log(`Generated: ${unhashedHtmlPath}`)
}

// Cleanup: Keep only the last N builds of hashed JS/CSS files
console.group("Cleaning up old builds")
for (const name of builtNames) {
  const jsPattern = new RegExp(`^${name}-(\\w{8})\\.js$`)
  const cssPattern = new RegExp(`^${name}-(\\w{8})\\.css$`)

  const allFiles = fs.readdirSync(outPath)

  // Group by extension
  const jsFiles = allFiles
    .filter((f) => jsPattern.test(f))
    .map((f) => ({
      name: f,
      path: path.join(outPath, f),
      stat: fs.statSync(path.join(outPath, f)),
    }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs) // newest first

  const cssFiles = allFiles
    .filter((f) => cssPattern.test(f))
    .map((f) => ({
      name: f,
      path: path.join(outPath, f),
      stat: fs.statSync(path.join(outPath, f)),
    }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs) // newest first

  // Delete old JS files (keep last N)
  if (jsFiles.length > KEEP_RECENT_BUILDS) {
    const toDelete = jsFiles.slice(KEEP_RECENT_BUILDS)
    for (const file of toDelete) {
      fs.unlinkSync(file.path)
      console.log(`Deleted old: ${file.name}`)
    }
  }

  // Delete old CSS files (keep last N)
  if (cssFiles.length > KEEP_RECENT_BUILDS) {
    const toDelete = cssFiles.slice(KEEP_RECENT_BUILDS)
    for (const file of toDelete) {
      fs.unlinkSync(file.path)
      console.log(`Deleted old: ${file.name}`)
    }
  }
}
console.groupEnd()

console.log("\n✅ Widget build complete!")
