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

// Clean output directory
const outPath = path.join(rootDir, outDir)
fs.rmSync(outPath, { recursive: true, force: true })
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

const outputs = fs
  .readdirSync(outPath)
  .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
  .map((f) => path.join(outPath, f))
  .filter((p) => fs.existsSync(p))

// Create hash from version
const h = crypto
  .createHash("sha256")
  .update(pkg.version, "utf8")
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

// Generate HTML files for each widget
for (const name of builtNames) {
  const hashedHtmlPath = path.join(outPath, `${name}-${h}.html`)
  const html = `<!doctype html>
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
  fs.writeFileSync(hashedHtmlPath, html, { encoding: "utf8" })
  console.log(`Generated: ${hashedHtmlPath}`)
}

console.log("\n✅ Widget build complete!")
