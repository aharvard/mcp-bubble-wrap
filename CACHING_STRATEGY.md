# Caching Strategy

## Overview

This project uses a **content-hashed assets + unhashed HTML** strategy to balance cache performance with update reliability.

## File Naming Strategy

```
bubble-wrap.html          ← Unhashed, stable URL
bubble-wrap-40902c14.js   ← Content-hashed (SHA-256 timestamp)
bubble-wrap-40902c14.css  ← Content-hashed (SHA-256 timestamp)
```

### Why Unhashed HTML?

- **Predictable URLs**: Widgets always load from `/{name}.html`
- **Fast updates**: HTML cache expires in 5 minutes vs hours/days
- **Reduced 404s**: Old HTML quickly refreshes to point at new assets

### Why Content-Hashed JS/CSS?

- **Long-term caching**: Edge CDN can cache indefinitely
- **Cache busting**: New builds get new URLs, forcing fresh downloads
- **Immutable assets**: Never worry about stale JS/CSS

## Cache Headers

### HTML Files (`*.html`)

```
Cache-Control: public, max-age=300, must-revalidate, stale-while-revalidate=60
```

- **5 minute cache** - Balances edge efficiency with update speed
- **must-revalidate** - Always check with origin after expiry
- **stale-while-revalidate=60** - Serve stale version while fetching fresh (UX)

### Content-Hashed Assets (`*-[hash].js`, `*-[hash].css`)

```
Cache-Control: public, max-age=31536000, immutable
```

- **1 year cache** - Effectively forever
- **immutable** - Never revalidate, file will never change

### Other Files

```
Cache-Control: public, max-age=3600
```

- **1 hour cache** - Moderate caching for other resources

## Asset Retention

The build process **keeps the last 3 builds** of each widget's JS/CSS files to handle cache overlap:

1. User loads `bubble-wrap.html` at 10:00 (cached for 5 min)
2. Deploy happens at 10:02
3. User's cache expires at 10:05, fetches new HTML
4. Old assets remain available during this window

**Configuration**: `KEEP_RECENT_BUILDS = 3` in `scripts/build-widgets.mts`

## Render.com Configuration

### render.yaml

No special configuration needed in `render.yaml`. The default settings work:

```yaml
services:
  - type: web
    name: mcp-bubble-wrap
    runtime: node
    region: virginia
    plan: free
    buildCommand: pnpm install && pnpm build
    startCommand: pnpm start
```

### Render Dashboard Settings

**✅ NO CHANGES REQUIRED** in the Render dashboard. However, verify these defaults:

1. **Static Site Caching**: OFF (we're not a static site)
2. **Custom Headers**: NONE NEEDED (Express sets Cache-Control headers)
3. **CDN**: Automatically enabled (Render's global edge network)

### How Render Caching Works

```
User Request
    ↓
Render Edge (Global CDN) ← Caches based on Cache-Control headers
    ↓ (cache miss or expired)
Your Express Server
    ↓
express.static() ← Sets Cache-Control headers
    ↓
Response with headers
```

**Key Points:**

- Render's edge respects `Cache-Control` headers set by your app
- No manual cache purging needed (HTML expires in 5 min)
- Content-hashed assets cached globally at edge for 1 year
- Free tier includes edge caching automatically

### Edge Behavior

1. **HTML requests** (`/bubble-wrap.html`):
   - Edge caches for 5 minutes
   - After expiry, revalidates with origin
   - Fast global delivery, quick updates

2. **Hashed asset requests** (`/bubble-wrap-40902c14.js`):
   - Edge caches for 1 year
   - Never revalidates (immutable)
   - Near-instant global delivery

3. **New deployments**:
   - New hash generated → new asset URLs
   - HTML updates in ≤5 minutes globally
   - Old assets remain available for cache overlap
   - Zero downtime deployments

## Testing Cache Behavior

### Test HTML Cache

```bash
# First request
curl -I https://your-app.onrender.com/bubble-wrap.html

# Should see:
# Cache-Control: public, max-age=300, must-revalidate, stale-while-revalidate=60
```

### Test Asset Cache

```bash
# Request hashed asset
curl -I https://your-app.onrender.com/bubble-wrap-40902c14.js

# Should see:
# Cache-Control: public, max-age=31536000, immutable
```

### Test After Deployment

```bash
# Deploy new version, wait 5-10 minutes
curl https://your-app.onrender.com/bubble-wrap.html

# HTML should reference new hash in <script> tag
```

## Troubleshooting

### Problem: Users seeing 404s after deployment

**Likely cause**: HTML cache hasn't expired yet, referencing old assets that were deleted

**Solution**:

- Check `KEEP_RECENT_BUILDS >= 3` (covers 15 minute window)
- Wait up to 5 minutes after deployment for edge cache to expire
- If persistent, increase `KEEP_RECENT_BUILDS` or HTML cache time

### Problem: Users not seeing latest changes

**Check 1**: Is it actually deployed?

```bash
curl https://your-app.onrender.com/bubble-wrap.html | grep "Hash:"
# Should show recent timestamp
```

**Check 2**: Is browser caching HTML?

- Hard refresh (Cmd/Ctrl + Shift + R)
- Clear browser cache
- Test in incognito mode

**Check 3**: Cache-Control headers being set?

```bash
curl -I https://your-app.onrender.com/bubble-wrap.html | grep Cache-Control
```

### Problem: Asset directory growing too large

Increase cleanup frequency or decrease retention:

```typescript
// In build-widgets.mts
const KEEP_RECENT_BUILDS = 2 // More aggressive cleanup
```

Or manually clean old assets:

```bash
# Keep only files modified in last 24 hours
find assets -name '*-[a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9].*' \
  -type f -mtime +1 -delete
```

## Summary

✅ **HTML**: Unhashed, 5-minute cache
✅ **JS/CSS**: Content-hashed, 1-year immutable cache  
✅ **Retention**: Keep last 3 builds
✅ **Render**: No special config needed
✅ **Zero downtime**: Assets available during cache overlap
