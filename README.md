# VisualFoundry

Production-ready image-to-video renderer built with Express and FFmpeg. The app accepts an uploaded image, applies a motion template, overlays branded copy, and returns a downloadable MP4 through a secure render endpoint.

## Running locally
1. Install dependencies
   ```bash
   npm install
   ```
2. Start the server
   ```bash
   npm start
   ```
3. Open http://localhost:3000 to use the yellow-themed web UI for uploads and rendering.

## Deployment notes
- Vercel is configured via `vercel.json` to route `/api/*` and `/health` to `server.js`, with a catch-all for static assets and the app shell.
- If you add OpenAI or other external APIs, avoid rewriting all routes directly to those providers. Proxy only the specific API paths from your server code and ensure the base URL ends with `/v1` (e.g., `https://api.openai.com/v1`). Double-check any `OPENAI_BASE_URL` env var so client requests do not concatenate duplicate path segments.
