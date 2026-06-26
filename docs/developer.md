# Developer Guide

## Installation
1. Clone the repository.
2. Run `npm install` to install dependencies.

## Local Setup
1. Copy `.env.example` to `.env` and fill in your `GEMINI_API_KEY`.
2. Ensure Firebase is configured in `firebase-applet-config.json`.

## Run the Application
1. Start the development server: `npm run dev`
2. The application will be available on the specified local port (default 3000).

## Folder Structure
- `/src`: Frontend React application code.
- `/docs`: Project documentation.
- `/server.ts`: Backend Express server.
- `/src/components`: UI Components.
- `/src/services`: Integration logic (Firebase, Calendar).
- `/src/types.ts`: Shared TypeScript types.

## Coding Standards
- Use TypeScript for all source code.
- Prefer Tailwind CSS for styling.
- Use modular components and custom hooks for complex state.
- Handle all external API keys via the Express backend, never expose them to the client.

## Build Process
Run `npm run build` to compile both the frontend and backend into the `dist/` directory.

## Troubleshooting
- If you encounter Vite HMR errors, they can be safely ignored in this environment.
- Ensure your `GEMINI_API_KEY` has access to Gemini 2.5 models for OCR and reasoning tasks.
