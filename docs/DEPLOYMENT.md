# ☁️ Deployment Guide

> Production deployment guide for Saarthi.

[← Back to README](../README.md)

---

## Build Process

Saarthi's production build is a two-stage process:

```bash
npm run build
```

This executes:

1. **`vite build`** — Bundles the React SPA into `dist/` with:
   - Tree shaking and dead code elimination
   - Asset hashing for cache busting
   - Code splitting for optimal load times

2. **`esbuild server.ts`** — Compiles the Express backend into a single file:
   - Output: `dist/server.cjs` (CommonJS format)
   - Platform: Node.js
   - Sourcemaps enabled
   - External packages (node_modules not bundled)

### Start Production

```bash
npm run start
# Equivalent to: node dist/server.cjs
```

The production server:
- Serves static files from `dist/`
- Handles all `/api/*` routes
- Manages WebSocket connections on `/live`
- Runs Telegram long polling
- Executes background daily digest worker

---

## Google Cloud Run (Recommended)

### Prerequisites
- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed (for containerized deploy)

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist/ ./dist/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
```

### Deploy

```bash
# Build the production bundle
npm run build

# Deploy to Cloud Run
gcloud run deploy saarthi \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=your_key,TELEGRAM_BOT_TOKEN=your_token" \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1
```

> **Note:** Set `--min-instances 1` to keep the Telegram long polling and daily digest worker alive. With 0 instances, background workers will not run when there are no HTTP requests.

### Environment Variables on Cloud Run

```bash
gcloud run services update saarthi \
  --set-env-vars "GEMINI_API_KEY=xxx,TELEGRAM_BOT_TOKEN=xxx,APP_URL=https://saarthi-xxx.run.app"
```

---

## Google AI Studio

Saarthi was built as an AI Studio applet. When deployed via AI Studio:

- `GEMINI_API_KEY` is **auto-injected** from user secrets
- `APP_URL` is **auto-injected** with the Cloud Run service URL
- Vite HMR is disabled via `DISABLE_HMR=true`
- File watching is disabled to save CPU during agent edits

### AI Studio Configuration

The `firebase-applet-config.json` and `firebase-blueprint.json` files are used by AI Studio to:
1. Auto-provision Firebase resources
2. Configure Firestore collections and schemas
3. Set up authentication

---

## Railway

### One-click Deploy

1. Fork the repository
2. Connect Railway to your GitHub repo
3. Set environment variables in Railway dashboard:
   - `GEMINI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `APP_URL` (set to your Railway URL)
   - `NODE_ENV=production`
4. Set build command: `npm run build`
5. Set start command: `npm run start`

---

## Render

### Configuration

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Settings:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Environment:** Node
4. Add environment variables in the dashboard

---

## Docker (Generic)

### Build & Run

```bash
# Build production bundle
npm run build

# Build Docker image
docker build -t saarthi .

# Run container
docker run -d \
  -p 3000:3000 \
  -e GEMINI_API_KEY=your_key \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e APP_URL=https://your-domain.com \
  -e NODE_ENV=production \
  saarthi
```

---

## Post-Deployment Checklist

- [ ] Verify `GEMINI_API_KEY` is set and working (`/api/gemini/chat` test)
- [ ] Verify Firebase config points to correct project (`firebase-applet-config.json`)
- [ ] Verify `firestoreDatabaseId` is set if using a named database
- [ ] Test Telegram webhook registration (`/api/telegram/debug`)
- [ ] Verify WebSocket connectivity (`/live` endpoint)
- [ ] Test Google Calendar OAuth flow (requires HTTPS)
- [ ] Confirm daily digest background worker is running (check server logs)
- [ ] Set `APP_URL` for OAuth callbacks and Telegram webhook auto-registration

---

## Health Monitoring

### Telegram Debug Endpoint

```bash
curl https://your-app.com/api/telegram/debug
```

Returns:
- Bot token status
- Webhook configuration
- `getMe` result
- Expected vs actual webhook URL

### Key Logs to Monitor

| Log Message | Meaning |
|:---|:---|
| `Server is running at http://0.0.0.0:3000` | Server started successfully |
| `Telegram Long Polling service initialized` | Telegram bot is active |
| `Vite middleware mounted in development mode` | Dev mode active |
| `Serving static file builds from dist folder` | Production mode active |
| `Gemini Live Session connected successfully` | Voice session established |

---

[← Back to README](../README.md) · [Telegram Setup →](TELEGRAM_SETUP.md)
