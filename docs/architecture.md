# System Architecture

## High-Level System Architecture
Saarthi is a React (Vite) Single Page Application (SPA) with a Node.js/Express backend that proxies calls to external services. The primary storage is Firebase Firestore, with authentication handled by Firebase Auth.

## Request Lifecycle
1. The user interacts with the React frontend.
2. The frontend directly reads/writes to Firestore for user-specific data (tasks, settings, events) using the Firebase Client SDK.
3. For AI-intensive operations (task decomposition, recovery planning, vision OCR, live voice), the frontend calls local `/api/*` Express endpoints.
4. The Express backend securely communicates with the Gemini API or other third-party services using server-side secrets.
5. The frontend handles the response, updating local state and Firestore as necessary.

## Data Flow
- **Task Management**: React State -> Firestore -> React State
- **AI Processing**: React -> Express Backend -> Gemini API -> Express Backend -> React -> Firestore
- **OAuth Sync**: React -> Google Workspace APIs -> Firestore

## Google Calendar Synchronization
When Google Calendar sync is active, Saarthi writes tasks and subtasks as events to the user's primary calendar using the Google Calendar API, appending specific metadata to identify Saarthi-managed events.

## Firebase Architecture
- **Firestore**: Stores tasks, user settings, calendar sync metadata, and historical event tracking. Uses security rules to ensure users can only access their own documents.
- **Auth**: Uses Google OAuth provider to seamlessly link users' identity with their Workspace capabilities.
