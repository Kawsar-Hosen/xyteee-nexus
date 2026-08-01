---
name: Gemini model selection
description: Which Gemini models work vs fail for this project's API key/account
---

## Rule
Use `gemini-3.5-flash` as the model for the AI chat endpoint. Do NOT use `gemini-2.0-flash` (free tier limit=0), `gemini-2.5-flash` (deprecated for new users), or `gemini-1.5-flash` (404 in v1beta SDK).

**Why:** The Google account's GEMINI_API_KEY has free-tier quota=0 for gemini-2.0-flash and gemini-2.0-flash-lite. gemini-2.5-flash returns 404 "no longer available to new users". gemini-3.5-flash responded successfully.

**How to apply:** If /api/ai/chat starts failing, run `uv run python3 -c "from google import genai; import os; client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY','')); [print(m.name) for m in client.models.list()]"` to list available models and pick a working one.

## SDK notes
- Package: google-genai (v2+), NOT google-generativeai
- Client init: `genai.Client(api_key=key)`
- Chat: `client.chats.create(model=..., config=GenerateContentConfig(...), history=[Content(...)])`
- Use `asyncio.to_thread(chat.send_message, msg)` — SDK is sync
- Model names do NOT need the `models/` prefix
