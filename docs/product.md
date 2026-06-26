# Product Documentation

## Overview
Saarthi is an AI-powered productivity companion designed to proactively assist users in planning, prioritizing, and completing tasks before deadlines are missed.

## Features
- **Intelligent task prioritization:** Computes an active risk score based on deadlines, remaining workload, and cognitive factors.
- **AI-powered scheduling assistance:** Breaks qualitative goals into subtasks with Gemini reasoning.
- **Personalized productivity recommendations:** Generates "Strategic Recovery Plans" and autonomous compromise strategies.
- **Context-aware reminders:** Actively tracks user effort and progress.
- **Calendar integration:** Real OAuth linkage connects active tasks to Google Calendar and Tasks.
- **Voice-enabled assistance:** Low-latency, real-time voice consultations with Gemini Live WebSockets.
- **Autonomous task planning and execution:** OCR engine utilizes Gemini Vision to automatically extract deadlines from documents.

## User Journey
1. **Onboarding**: The user signs in via Google and connects their calendar.
2. **Commitment Capture**: The user enters a new task or uploads a syllabus photo for OCR extraction.
3. **Decomposition**: Saarthi breaks down the task into sub-milestones with time estimates.
4. **Execution**: The user works through the milestones. The Completion Confidence Engine tracks their progress against the deadline.
5. **Recovery**: If the user falls behind, Saarthi triggers a Recovery Plan to salvage the commitment.
