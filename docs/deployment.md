# Deployment Guide

## Production Build
To prepare the application for production, run:
`npm run build`

This command runs `vite build` for the frontend and `esbuild` to bundle `server.ts` into a CommonJS backend application at `dist/server.cjs`.

## Required Secrets
Ensure the following environment variables are set in your production environment:
- `GEMINI_API_KEY`: Required for all AI operations.

## Hosting
The bundled application can be hosted on any environment that supports Node.js (e.g., Google Cloud Run, Heroku, Render). Start the server using:
`npm start`

## Environment Configuration
Ensure your `firebase-applet-config.json` correctly points to your production Firebase project. No further configuration is needed for Firebase as the client SDK initializes based on this file.
