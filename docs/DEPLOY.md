# Deployment Guide — Frostreaver Loot Buckets

**Last Updated**: April 29, 2026  
**Launch Date**: May 27, 2026 12:00 PM PT  
**Status**: Pre-launch

---

## Pre-Deploy Checklist

Complete all items below before deploying to production. Use this checklist for every production deployment.

### Code Quality

- [ ] TypeScript: `npx tsc --noEmit` shows zero errors
- [ ] Build: `npm run build` succeeds with no warnings
- [ ] Linting: `npm run lint` passes
- [ ] No hardcoded secrets, API keys, or credentials anywhere in code

### Data Integrity

- [ ] All required JSON files present in `data/excel-imports/`:
  - [ ] `classic-group-named.json`
  - [ ] `classic-raid.json`
  - [ ] `classic-five-item.json`
  - [ ] `epic-quests-fallback.json`
  - [ ] `crafting-fallback.json`
  - [ ] `factions-fallback.json`
  - [ ] `expansion-schedule.json`
- [ ] `data/item-details.json` is present and contains full enriched data
- [ ] `data/all-item-names.json` is current
- [ ] No cache artifacts will be deployed (`.next/cache/` should not be committed)

### Assets & PWA

- [ ] Favicon bundled (favicons in `public/`)
- [ ] PWA icons exist and valid:
  - [ ] `public/icons/icon-192.png` (192x192, sharp and crisp)
  - [ ] `public/icons/icon-512.png` (512x512, high-DPI quality)
  - [ ] `public/icons/icon-maskable.png` (512x512, safe zone respected)
- [ ] `public/manifest.json` is configured correctly (already done; verify theme-color is `#2d6a4f`)
- [ ] Service worker files exist:
  - [ ] `public/sw.js` is the active production worker
  - [ ] `public/sw-killswitch.js` is committed as emergency backup
- [ ] SEO files configured:
  - [ ] `public/robots.txt` present and allows indexing for production domain
  - [ ] `public/sitemap.xml` or sitemap routes configured
  - [ ] OG image and meta tags ready (see SEO section below)

### Environment

- [ ] `.env.local` is **not** committed to repo (should be in `.gitignore`)
- [ ] No required environment variables for static site (Frostreaver is data-driven; no API calls at runtime)
- [ ] `next.config.ts` is production-ready (currently minimal and safe)

### Testing

- [ ] All main routes load without errors:
  - [ ] `/` (Group Named loot buckets)
  - [ ] `/raids`
  - [ ] `/favorites`
  - [ ] `/crafting`
  - [ ] `/factions`
  - [ ] `/epics`
  - [ ] `/offline` (PWA offline fallback)
- [ ] Favicon loads in browser tab
- [ ] PWA manifest loads (`chrome://inspect` → manifest section)
- [ ] Service worker registers (DevTools → Application → Service Workers)
- [ ] Mobile viewport renders correctly (responsive design check)
- [ ] Dark mode toggle works
- [ ] Server selector (Frostreaver/Mischief/Teek) persists across navigation

---

## Deployment Strategies

Choose one based on your hosting needs and team expertise.

### Strategy 1: Vercel (Recommended — Zero Config)

**Pros**: Auto-scaling, zero-downtime, instant rollback, preview deployments, free tier sufficient for static site, Next.js native integration.  
**Cons**: Vendor lock-in, custom domain requires Vercel DNS or DNS records.  
**Cost**: Free tier handles typical traffic; paid if > 100 concurrent functions.  
**Setup time**: 5 minutes.

#### Step 1: Connect GitHub Repository

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click **Import Project**
4. Select the `mq-offset-updater` repository (or whatever your GitHub org/repo is)
5. Vercel auto-detects Next.js 16
6. Leave build settings as default:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

#### Step 2: Configure Environment (Optional)

Since Frostreaver is data-driven (no runtime API calls), no env vars needed. If you add an API later:

1. Go to **Settings** → **Environment Variables**
2. Add any `NEXT_PUBLIC_*` vars (accessible client-side)
3. Redeploy

#### Step 3: Custom Domain

1. Go to **Settings** → **Domains**
2. Add your custom domain (e.g., `frostreaver-loot.com`)
3. Follow DNS setup (CNAME or A record)
4. SSL auto-provisions in ~48 hours

#### Step 4: Branch & Preview Deployments

- **Main branch** auto-deploys to production
- **PR branches** auto-generate preview URLs (shared with team before merging)
- Cancel auto-deployment: Settings → **Git** → uncheck "Automatic Deployments" if needed

#### Rollback from Vercel

1. Go to **Deployments**
2. Find the last working deployment
3. Click the three-dot menu → **Promote to Production**
4. Instant rollback (< 1 second)

---

### Strategy 2: Cloudflare Pages (Alternative — Great Free Tier)

**Pros**: Edge runtime, fast global CDN, excellent free tier, low cold-start latency, good for SEO (content served from edge nodes close to users).  
**Cons**: Some Next.js 16 features (ISR, server actions) may not work on edge runtime; requires workaround.  
**Cost**: Free tier excellent for loot database; paid if > 500 deployments/month.  
**Setup time**: 5 minutes.

#### Step 1: Connect GitHub Repository

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Sign in with GitHub
3. Click **Create a project**
4. Select the repository
5. Configure build settings:
   - **Framework**: Next.js
   - **Build command**: `npm run build`
   - **Build output directory**: `.next/static`

#### Step 2: Environment Variables

1. Go to **Settings** → **Environment Variables**
2. Add `NEXT_PUBLIC_*` vars if needed
3. Redeploy

#### Step 3: Custom Domain

1. In **Settings** → **Custom domains**
2. Add your domain
3. Cloudflare handles DNS automatically if you use Cloudflare nameservers
4. Otherwise, add CNAME record to `pages.cloudflare.com`

#### Next.js 16 Compatibility Notes

Test these features before production (Cloudflare Pages may not support all):

- **Incremental Static Regeneration (ISR)**: Works if you don't rely on `revalidate` with `seconds`. Pre-render static.
- **Server Actions**: May fail on edge. Keep mutations small or route to external API.
- **Middleware**: Works on Cloudflare; test before shipping.

**Recommendation**: Use Vercel if you plan heavy dynamic features; Cloudflare if static-first (which Frostreaver is).

#### Rollback from Cloudflare Pages

1. Go to **Deployments**
2. Find the last working deployment
3. Click **Rollback to this deployment**
4. Instant switch (< 10 seconds)

---

### Strategy 3: Self-Hosted Docker (Maximum Control)

**Pros**: Full control, self-owned infrastructure, custom domain trivial, no vendor dependency, cost-efficient if you have existing server.  
**Cons**: Ops burden (monitoring, security updates, scaling), longer deployment (build + push + pull), more moving parts.  
**Cost**: Depends on server (DigitalOcean, Linode, AWS EC2, or internal). Estimate $5-20/month for single instance.  
**Setup time**: 30 minutes (first time), 5 minutes (subsequent).

#### Step 1: Build Docker Image

Provided `Dockerfile` in this repo. Basic flow:

```bash
# Build locally for testing
docker build -t frostreaver:latest .

# Run locally to test
docker run -p 3000:3000 frostreaver:latest
# Visit http://localhost:3000

# Push to registry (Docker Hub, GitHub Container Registry, or private registry)
docker tag frostreaver:latest username/frostreaver:latest
docker push username/frostreaver:latest
```

#### Step 2: Deploy to Server

**Option A: Docker + Docker Compose** (Recommended for simplicity)

```bash
# On your server, create a directory
mkdir -p /opt/frostreaver
cd /opt/frostreaver

# Copy docker-compose.yml to server
scp docker-compose.yml user@server:/opt/frostreaver/

# SSH to server
ssh user@server

# Pull latest image and start
cd /opt/frostreaver
docker-compose pull
docker-compose up -d

# Verify
docker-compose ps
curl http://localhost:3000
```

**Option B: Kubernetes** (For larger deployments)

```bash
# Create a deployment manifest
kubectl apply -f deployment.yaml

# (Not provided here; contact DevOps)
```

#### Step 3: Reverse Proxy (Nginx/Caddy)

Expose the container via HTTPS:

**Nginx** (`/etc/nginx/sites-available/frostreaver`):
```nginx
server {
    listen 80;
    server_name frostreaver-loot.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name frostreaver-loot.com;

    ssl_certificate /etc/letsencrypt/live/frostreaver-loot.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/frostreaver-loot.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Use **Let's Encrypt** for free SSL:
```bash
certbot certonly --standalone -d frostreaver-loot.com
```

#### Step 4: Health Checks & Monitoring

The provided `Dockerfile` includes a healthcheck:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1
```

Monitor container health:
```bash
docker-compose logs frostreaver
docker stats frostreaver
```

#### Rollback with Docker

Keep the last 3 images tagged:
```bash
docker tag frostreaver:v2.0 frostreaver:v1.9
docker run -d -p 3000:3000 frostreaver:v1.9  # Roll back by tag
```

Or use Docker stack with version pinning in `docker-compose.yml`:
```yaml
image: username/frostreaver:v1.9  # Pin to known good version
```

---

## SEO & Search Console

### Robots.txt

Create `public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://frostreaver-loot.com/sitemap.xml
```

### Sitemap

Create `public/sitemap.xml` or use Next.js sitemap route handler (`app/sitemap.ts`):

```typescript
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://frostreaver-loot.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://frostreaver-loot.com/raids',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: 'https://frostreaver-loot.com/crafting',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
```

### Open Graph Image

Update `app/layout.tsx` metadata to include OG image:

```typescript
export const metadata: Metadata = {
  title: "Frostreaver Loot Buckets",
  description: "Classic Group Named random loot bucket analysis for EverQuest Frostreaver.",
  openGraph: {
    title: "Frostreaver Loot Buckets",
    description: "Fastest loot reference for EverQuest TLP servers.",
    url: "https://frostreaver-loot.com",
    siteName: "Frostreaver Loot Buckets",
    images: [
      {
        url: "https://frostreaver-loot.com/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};
```

Create `public/og-image.png` (1200x630 px, brand colors, clear logo/text).

### Google Search Console

1. Go to [google.com/webmasters](https://search.google.com/search-console/about)
2. Add your domain (standard or property-level)
3. Verify ownership (DNS TXT record or HTML file upload)
4. Submit sitemap via **Sitemaps** menu
5. Monitor coverage, indexing, and search queries

### Bing Webmaster Tools

1. Go to [bing.com/webmasters](https://www.bing.com/webmasters)
2. Add site
3. Verify via DNS or XML
4. Submit sitemap
5. Monitor crawl stats

---

## Analytics (Privacy-Friendly)

For a loot database, basic analytics help you understand user behavior without cookies.

### Recommended: Plausible Analytics

[Plausible.io](https://plausible.io) — No cookies, no consent banner, GDPR-compliant.

1. Sign up (14-day free trial, then ~$10/mo)
2. Add your site
3. Get tracking script:
   ```html
   <script defer data-domain="frostreaver-loot.com" src="https://plausible.io/js/script.js"></script>
   ```
4. Add to `app/layout.tsx` `<head>` section
5. Launch and monitor real-time dashboard

### Alternative: Umami

[Umami.is](https://umami.is) — Self-hosted or cloud, lightweight, GDPR-friendly.

1. Deploy Umami (self-hosted or cloud version)
2. Create a site in Umami dashboard
3. Add tracking script to `app/layout.tsx`:
   ```html
   <script async defer src="https://your-umami-domain/script.js" data-website-id="xxxxx"></script>
   ```

Key metrics to watch:
- **Pageviews**: Which loot buckets are popular?
- **Session duration**: Are users exploring or bouncing?
- **Top pages**: Where do farmers spend time?
- **Referrers**: Are Discord/Reddit links driving traffic?

---

## Uptime Monitoring

Monitor your site to catch outages immediately.

### Option 1: Uptime Robot (Free)

[uptimerobot.com](https://uptimerobot.com) — Free uptime monitoring with alerts.

1. Sign up
2. Add a new monitor:
   - **Monitor Type**: HTTPS
   - **URL**: `https://frostreaver-loot.com`
   - **Check Interval**: 5 minutes
3. Set alert: Email/Slack/Discord
4. Dashboard shows uptime %

### Option 2: Built-in to Hosting

- **Vercel**: Built-in edge health checks
- **Cloudflare Pages**: Free uptime monitoring in analytics
- **Docker**: Use external monitoring (Uptime Robot or your own)

---

## Post-Deploy Verification Checklist

After deploying, run through this in the first hour:

- [ ] Visit main page (`/`): loads, renders loot buckets
- [ ] Visit `/raids`: data displays
- [ ] Visit `/favorites`: empty state shows (or saved items load)
- [ ] Visit `/offline`: displays (PWA offline page)
- [ ] Favicon visible in browser tab
- [ ] PWA manifest loads (DevTools → Application → Manifest)
- [ ] Service worker registered (DevTools → Application → Service Workers)
- [ ] Dark mode toggle works
- [ ] Server selector persists (Frostreaver/Mischief/Teek)
- [ ] Responsive on mobile (test in Chrome DevTools mobile view)
- [ ] No console errors (DevTools → Console)
- [ ] sitemap.xml accessible at `/sitemap.xml`
- [ ] robots.txt accessible at `/robots.txt`
- [ ] HTTPS enforced (no mixed content warnings)

---

## Launch Day (May 27, 2026)

### Pre-Launch (May 26, 11:59 PM PT)

- [ ] Final data sync: all JSON files in `data/` are current
- [ ] Deploy any pending code changes to production
- [ ] Verify all routes load on production domain
- [ ] Test PWA on mobile (iOS Safari, Android Chrome)
- [ ] Spot-check item detail pages for accuracy
- [ ] Verify ServerStatusBadge component is ready to transition at launch time

### Launch Hour (May 27, 12:00 PM PT)

- [ ] Monitor error logs for first 15 minutes
- [ ] Check traffic dashboard (analytics, uptime monitoring)
- [ ] Verify ServerStatusBadge shows "live" state at correct UTC time
- [ ] Test a few searches from Discord/Reddit to confirm discovery

### First 24 Hours

- [ ] Monitor error rate (target: < 0.1%)
- [ ] Check response times (target: < 500ms p95)
- [ ] Verify no data integrity issues (all loot buckets render correctly)
- [ ] Monitor uptime (target: 99.9%+)
- [ ] Respond to Discord/Reddit feedback in real-time
- [ ] Prepare rollback plan if critical issue found

### If Rollback Needed

**Vercel**: Click **Deployments** → find last working deployment → **Promote to Production** (< 1 sec)

**Cloudflare Pages**: Click **Deployments** → **Rollback to this deployment** (< 10 sec)

**Docker**: Re-tag and restart previous image:
```bash
docker-compose down
docker tag frostreaver:latest frostreaver:broken
docker tag frostreaver:v1.9 frostreaver:latest
docker-compose up -d
```

---

## Ongoing Operations

### Data Updates

If loot data changes post-launch:

1. Update JSON files in `data/`
2. Run `npm run build`
3. Deploy (Vercel/Cloudflare auto-deploy on merge; Docker: rebuild and push)
4. Service worker will auto-refresh on next visit (cache version via `CACHE_NAME` in `public/sw.js`)

### Service Worker Updates

If you ship a new service worker version:

1. Edit `public/sw.js`
2. Update `CACHE_NAME` constant (e.g., `frostreaver-v2`)
3. Deploy
4. Users get new SW on next page load; old caches auto-delete

See `docs/PWA.md` for emergency kill-switch procedure.

### Monitoring Alerts

Set up alerts for:
- **Error rate > 1%**: Check logs immediately
- **Response time p95 > 1s**: Possible data size issue
- **Downtime**: Instant escalation
- **SSL certificate expiry** (Docker/self-hosted): Auto-renewal via certbot

---

## Recommended Deployment Path

For **launch (May 27, 2026)** and **ongoing**:

### Best: Vercel

- Zero ops overhead
- Auto-scaling
- Instant preview deployments for PRs
- Rollback in one click
- Free tier sufficient for EQ community site
- **Recommendation**: Use this unless you have existing infrastructure.

### Good: Cloudflare Pages

- Fast CDN globally
- Edge runtime
- Great free tier
- Simple DNS setup
- **Recommendation**: Use if you prefer Cloudflare infrastructure or need edge computing.

### Viable: Self-hosted Docker

- Full control
- Fixed cost
- Existing CI/CD integration
- Ops burden (monitoring, updates, security)
- **Recommendation**: Use only if you have DevOps team or prefer self-hosted.

---

## CI/CD Workflow

Provided: `.github/workflows/ci.yml`

This workflow:
1. Runs on push to `main` and all PRs
2. Installs deps
3. Runs lint
4. Runs TypeScript type-check
5. Builds the app
6. Reports results

For production deploy:
- **Vercel**: Auto-deploys on merge to `main` (configured in Vercel dashboard)
- **Cloudflare Pages**: Auto-deploys on merge to `main` (configured in Cloudflare dashboard)
- **Docker**: Push trigger to your registry (GitHub Actions Docker push action)

---

## Troubleshooting

### Build Fails on Deploy

1. Check `npm run build` locally: `npx tsc --noEmit && npm run build`
2. Ensure all data JSON files are valid: `npm run validate:item-details`
3. Check for missing dependencies: `npm install`
4. Clear build cache:
   - **Vercel**: Settings → **Deployments** → **Clear Build Cache**
   - **Cloudflare**: Clear cache manually in dashboard

### Service Worker Not Updating

1. Hard-refresh (Ctrl+F5 or Cmd+Shift+R)
2. Clear Application cache (DevTools → Application → Storage → Clear site data)
3. Check `CACHE_NAME` in `public/sw.js` was bumped
4. If still broken, use kill-switch: copy `public/sw-killswitch.js` over `public/sw.js` and deploy (see `docs/PWA.md`)

### Sitemap/Robots.txt Not Found

- Ensure files exist in `public/` directory
- Both must be committed to repo (not `.gitignored`)
- Verify after deploy: `https://your-domain/robots.txt` and `https://your-domain/sitemap.xml`

### Data Not Updating Post-Launch

1. Confirm `data/*.json` files are fresh on production server
2. Force cache invalidation:
   - Update `CACHE_NAME` in `public/sw.js`
   - Hard-refresh in browser (Ctrl+F5)
   - Service worker will delete old caches on activate

---

## Support & Escalation

| Issue | Owner | Action |
|-------|-------|--------|
| Deployment fails | DevOps / Deployment Engineer | Check logs, rollback, investigate |
| Data integrity issue | Data Team | Validate JSON, rerun pipeline, redeploy |
| Performance degradation | SRE | Check analytics, monitor, scale if needed |
| Security issue | Security Team | Assess severity, patch, redeploy, communicate |
| Outage | On-call | Alert team, rollback or restore, postmortem |

---

## References

- **Next.js Docs**: https://nextjs.org/docs
- **Vercel Deployment**: https://vercel.com/docs/deployments/overview
- **Cloudflare Pages**: https://developers.cloudflare.com/pages/
- **Docker Best Practices**: https://docs.docker.com/develop/develop-images/dockerfile_best-practices/
- **PWA & Service Workers**: `/docs/PWA.md`
- **Competitive Positioning**: `/docs/COMPETITIVE_POSITIONING.md` (GTM playbook)

---

**Questions?** Refer to this document during launch, deploy, and operations. Keep it updated as deployment strategy evolves.
