# 🤖 Telegram Bot Setup

> Step-by-step guide to configuring, linking, and managing the Telegram Companion Bot.

[← Back to README](../README.md)

---

## Overview

Saarthi features a deeply integrated Telegram bot that acts as your mobile execution companion. It provides:
- Morning priority briefings
- Evening reflections
- Real-time critical task alerts
- Interactive micro-mission prompts

The bot uses **Long Polling** by default (runs natively without webhooks), with dynamic fallback to **Webhooks** if an `APP_URL` is provided.

---

## 1. Create a Bot via @BotFather

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send the command `/newbot`
3. Choose a name for your bot (e.g., "Saarthi Companion")
4. Choose a username (must end in `bot`, e.g., `my_saarthi_bot`)
5. BotFather will provide an **HTTP API Token**. Save this.

---

## 2. Configure the Backend

Add the token to your `.env` file (or Cloud Run environment variables):

```env
TELEGRAM_BOT_TOKEN=123456789:ABCDEF_GHIJKL_MNOPQRSTUVWXYZ
```

> **Optional:** If you are deploying to production (Cloud Run, Railway) and want webhook mode instead of long polling, set `APP_URL`:
> ```env
> APP_URL=https://my-saarthi-app.com
> ```
> The server will automatically register the webhook at `${APP_URL}/api/telegram/webhook` on startup.

---

## 3. Link Your Account

To securely link your Saarthi web account to your Telegram app:

1. Open the Saarthi Web App
2. Go to **Settings > Telegram Companion**
3. Click **Generate Link Code**
4. The system will generate a temporary 8-character code (e.g., `SAR-X9V2`)
5. Open your Telegram bot and send the code: `/start SAR-X9V2`
6. The bot will confirm the link. Your chat ID is now securely stored in your `userSettings`.

---

## 4. Daily Briefings

### How it Works
The server runs a background worker (`setInterval` every 15 seconds) that checks if any user is scheduled to receive a briefing.

### Configuration
Users configure their briefing times in the Settings panel. The times are stored in `userSettings` under `telegramAlertSlots`.

```json
{
  "userSettings": {
    "user_123": {
      "telegramChatId": 987654321,
      "telegramAlertSlots": ["08:00", "20:00"],
      "timezone": "Asia/Kolkata"
    }
  }
}
```

### The Generation Flow
1. Worker detects a time match
2. Calls `engagementService.generateBriefing()`
3. Evaluates current behavioral state (e.g., `burned_out` vs `highly_engaged`)
4. Uses `gemini-3.5-flash` to generate an emotionally calibrated message
5. Dispatches via Telegram Bot API

---

## 5. Critical Alerts

When a task enters the **Critical Risk Zone** (score ≥ 70) and the deadline is approaching, Saarthi automatically pushes an alert to Telegram.

This triggers the Recovery OS protocol via chat:
> *"🚨 Heads up. The DBMS Exam Prep is at critical risk. Do you want me to generate a Recovery Plan?"*

---

## 6. Troubleshooting

### Diagnostic Endpoint

If your bot isn't responding, check the diagnostic API:

```bash
curl https://your-app.com/api/telegram/debug
```

**Common Issues:**

| Symptom | Cause | Solution |
|:---|:---|:---|
| `getMeError: 401 Unauthorized` | Invalid Bot Token | Double check `.env` token |
| `webhookRegisterResult: 400` | Invalid `APP_URL` | Ensure URL has HTTPS (required by Telegram) |
| Web app says "Waiting for linking" | Long polling isn't running | Ensure `npm run dev` or production server is active |
| No morning briefings | Timezone mismatch | Check timezone setting in web app profile |

---

[← Back to README](../README.md) · [Gemini Models Guide →](GEMINI_MODELS.md)
