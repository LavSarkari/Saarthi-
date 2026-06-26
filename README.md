<div align="center">
  
# 🚀 Saarthi: The Last-Minute Life Saver
### *Stop missing deadlines. Start executing.*

[![Built with React](https://img.shields.io/badge/Built_with-React_18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Powered by Gemini](https://img.shields.io/badge/Powered_by-Google_Gemini-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Styled_with-Tailwind-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

An AI-powered productivity companion that **proactively assists users in planning, prioritizing, and completing tasks** before deadlines are missed.

</div>

---

## 🌪️ The Problem
Students, professionals, and entrepreneurs frequently miss critical deadlines—assignments, meetings, bill payments, interviews, and important commitments. 

**Existing productivity tools are fundamentally flawed.** They rely on *passive reminders* (e.g., "Homework due tomorrow") that are incredibly easy to ignore. They tell you *when* something is due, but they do absolutely nothing to help you *actually complete the task* when you are overwhelmed, procrastinating, or running out of time.

## 💡 The Solution: Saarthi
**Saarthi** (The Last-Minute Life Saver) is a proactive execution engine. It moves beyond traditional reminders by autonomously breaking down your workload, calculating feasibility, and dynamically generating tactical recovery plans to ensure you cross the finish line—no matter how late you start.

It doesn't just remind you; it actively coaches you to success.

---

## ✨ Hackathon-Winning Features

### 🧠 1. Intelligent Task Prioritization (Completion Confidence Engine)
Forget standard "High/Medium/Low" tags. Saarthi continuously computes an active **Risk Score** for every commitment based on hard deadlines, remaining workload, and cognitive factors. Tasks automatically transition to "critical" status as you fall behind, focusing your attention exactly where it matters most.

### 📅 2. AI-Powered Scheduling Assistance
Stop guessing how long things take. Give Saarthi a raw, qualitative goal (e.g., *"Write a 10-page research paper"*), and the **Gemini Reasoning Model** instantly breaks it into a logical, step-by-step roadmap with scientifically estimated time blocks optimized for your schedule.

### 🚑 3. Personalized Productivity Recommendations & Recovery
When a severe scheduling conflict or time shortage is detected, Saarthi generates **Strategic Recovery Plans**. It autonomously suggests compromise strategies (e.g., *"Focus only on chapters 1-3 to secure a passing grade"*), ensuring you secure the absolute baseline passing threshold rather than failing entirely.

### 🔔 4. Context-Aware Reminders
Standard apps send generic alerts. Saarthi actively tracks your effort and progress. If you haven't started a 5-hour task and it's due in 6 hours, Saarthi issues a context-aware intervention, proactively recalculating feasibility and suggesting immediate action, rather than just pinging your phone.

### 🔄 5. Calendar Integration & Goal Tracking
Real OAuth 2.0 linkage connects your AI-generated subtasks directly to **Google Calendar** and **Google Tasks**. This creates unified accountability—your dynamically adjusted AI roadmap perfectly syncs with your real-world schedule.

### 🎙️ 6. Voice-Enabled Assistance (Gemini Live)
Feeling overwhelmed? Engage in low-latency, real-time voice consultations with a tactical AI coach using **Gemini Live WebSockets**. Brainstorm approaches, refine deadlines, or trigger recovery plans completely hands-free while you work.

### 📸 7. Autonomous Task Planning & Execution (Vision OCR)
Don't waste time typing out lengthy syllabi or copy-pasting homework guidelines. Snap a photo of a document or syllabus, and the **Gemini Vision OCR Engine** will automatically extract deadlines, estimate workloads, and autonomously plan your entire month.

---

## 🚀 Installation & Local Development

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd saarthi
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up Environment Variables:**
   Copy `.env.example` to `.env` and configure your API keys (e.g., `GEMINI_API_KEY`).
4. **Configure Firebase:**
   Ensure `firebase-applet-config.json` points to your project.
5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   The application will start in development mode, typically on port 3000.

---

## 🏗️ Technical Architecture & Stack

We built Saarthi to be lightning-fast, highly scalable, and completely seamlessly integrated with Google's ecosystem.

*   **Frontend**: React 18, Vite, TypeScript
*   **Styling & Animation**: Tailwind CSS, Framer Motion, Lucide Icons
*   **Backend & API Proxy**: Node.js, Express (Full-stack ESM architecture)
*   **Database & Auth**: Firebase Firestore (Real-time NoSQL) & Firebase Authentication (Google OAuth)
*   **AI Integration**: Google GenAI SDK (`@google/genai`)
    *   *Gemini 2.5 Flash* (Fast task decomposition & recovery planning)
    *   *Gemini Vision* (OCR & Document parsing)
    *   *Gemini Live API* (Real-time WebSockets for voice assistance)
*   **Third-Party Integrations**: Google Workspace APIs (Calendar Events, Google Tasks)

---

## 🎯 Evaluation Focus & Impact
Saarthi demonstrates a fundamental shift in Human-Computer Interaction (HCI) within productivity software. Instead of the user managing the tool, **the tool manages the user's risk**. 

By anticipating failure and helping users make data-driven, tactical decisions when under pressure, Saarthi transforms the overwhelming nature of "impossible deadlines" into a sequence of hyper-actionable, intelligently scheduled, and highly achievable steps.

---

<div align="center">
  <i>Designed and engineered for those who need a lifeline, not just a reminder.</i>
</div>
