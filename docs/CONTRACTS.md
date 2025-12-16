# StreamSuites — Bot ↔ Dashboard Contracts
Version: v1 (Initial)
Status: Authoritative Source of Truth

This document defines the **explicit contracts** between:

- StreamSuites runtime bots (starting with Rumble)
- The StreamSuites Dashboard (GitHub Pages / iframe-safe)

All schemas, validators, and enforcement layers MUST be derived from this document.
If behavior and schema disagree, THIS DOCUMENT WINS.

---

## 1. CORE PRINCIPLES

### 1.1 Source of Truth
- The bot is the **runtime authority**
- The dashboard is the **configuration and visibility surface**
- The dashboard NEVER executes bot logic
- The bot NEVER trusts dashboard input blindly

### 1.2 Transport Neutrality
This contract describes **payload shape**, not transport:
- File-based
- REST
- WebSocket
- Polling
- IPC

All transports MUST serialize these shapes exactly.

---

## 2. GLOBAL CONCEPTS

### 2.1 Identifiers
- `creator_id` — string, stable, user-defined
- `platform` — enum (`rumble`, `youtube`, `twitch`, etc.)
- `poll_id` — string, runtime-generated
- `trigger_id` — implicit index (v1), explicit ID (v2)

### 2.2 Timestamps
All timestamps:
- ISO 8601
- UTC
- Example: `2025-01-17T09:21:33Z`

---

## 3. DASHBOARD → BOT CONTRACTS (CONFIGURATION)

### 3.1 Creators Configuration

Source:
- Dashboard UI
- Stored locally
- Exported/imported by user

Payload Shape:
```json
{
  "creator_id": "example_creator",
  "display_name": "Example Creator",
  "platforms": {
    "rumble": {
      "enabled": true,
      "watch_url": "https://rumble.com/vxxxx"
    }
  }
}
