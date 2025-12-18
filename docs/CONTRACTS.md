# StreamSuites — Bot ↔ Dashboard Contracts
Version: v1.2
Status: Authoritative Source of Truth

This document defines the explicit contracts between:

- StreamSuites runtime bots (starting with Rumble)
- The StreamSuites Dashboard (GitHub Pages / iframe-safe)

All schemas, validators, enforcement layers, and runtime behavior MUST be derived from this document.
If behavior and schema disagree, THIS DOCUMENT WINS.

-------------------------------------------------------------------------------

## 1. CORE PRINCIPLES

### 1.1 Source of Truth
- The bot is the runtime authority
- The dashboard is the configuration and visibility surface
- The dashboard NEVER executes bot logic
- The bot NEVER trusts dashboard input blindly

### 1.2 Transport Neutrality
This contract describes payload shape, not transport:
- File-based
- REST
- WebSocket
- Polling
- IPC

All transports MUST serialize these shapes exactly.

-------------------------------------------------------------------------------

## 2. GLOBAL CONCEPTS

### 2.1 Identifiers

#### 2.1.1 creator_id (AUTHORITATIVE)

- creator_id is the primary identity key across the entire StreamSuites system
- It MUST be:
  - Exactly 6 characters
  - Alphanumeric only (A–Z, a–z, 0–9)
  - Case-sensitive

Example:
As5TyU

Rules:
- Human-readable IDs (e.g. daniel, john_smith) are DEPRECATED
- The bot MUST treat creator_id as an opaque identifier
- The dashboard MUST NOT allow manual editing of creator_id once created
- All future references (polls, clips, jobs, logs) MUST reference this value

Migration rules:
- Existing projects must migrate creator IDs in a single atomic change
- Mixed ID formats MUST NOT coexist
- Schema validation MUST reject non-compliant IDs

---

### 2.2 Other Identifiers
- platform — enum (rumble, youtube, twitch, twitter, discord, etc.)
- poll_id — string, runtime-generated
- trigger_id — implicit index (v1), explicit ID (v2)
- job_id — runtime-generated, opaque

---

### 2.3 Timestamps
All timestamps:
- ISO 8601
- UTC
- Example: 2025-01-17T09:21:33Z

-------------------------------------------------------------------------------

## 3. DASHBOARD → BOT CONTRACTS (CONFIGURATION)

### 3.1 Creators Configuration

Source:
- Dashboard UI
- Stored locally
- Exported/imported by user

Payload Shape:
```
{
  "creator_id": "As5TyU",
  "display_name": "Example Creator",
  "enabled": true,
  "platforms": {
    "rumble": true,
    "youtube": true,
    "twitch": true
  }
}
```

Rules:
- creator_id is required and immutable
- display_name is UI-only and non-authoritative
- Platform flags MAY be omitted
- The bot MUST ignore unsupported platforms silently

---

### 3.2 Chat Behaviour / Triggers

Runtime target:
shared/config/chat_behaviour.json

Payload Shape:
```
{
  "poll_seconds": 2,
  "send_cooldown_seconds": 0.75,
  "baseline_mode": "latest_seen",
  "baseline_grace_seconds": 0,
  "enable_startup_announcement": true,
  "startup_announcement": "🤖 StreamSuites bot online",
  "triggers": [
    {
      "match": "!ping",
      "match_mode": "equals_icase",
      "response": "pong",
      "cooldown_seconds": 0.75
    }
  ]
}
```

Rules:
- triggers is an ordered list
- Order matters (first match wins)
- Per-trigger cooldowns are optional
- Bot MUST enforce cooldowns
- Dashboard MUST NOT attempt to simulate trigger execution

-------------------------------------------------------------------------------

## 4. BOT → DASHBOARD CONTRACTS (RUNTIME STATE)

### 4.1 Platform Status (Example: Rumble)

Target UI:
docs/views/platforms/rumble.html

Payload Shape:
```
{
  "platform": "rumble",
  "bot_status": "online",
  "last_seen": "2025-01-17T09:21:33Z",
  "active_stream": {
    "title": "Live Stream Title",
    "watch_url": "https://rumble.com/vxxxx"
  },
  "chat_activity": {
    "last_trigger": "!ping",
    "last_message": "pong",
    "triggers_today": 42
  },
  "modules": {
    "triggers": true,
    "clips": false,
    "polls": false
  }
}
```

Rules:
- Missing fields imply unknown
- Dashboard MUST degrade gracefully
- Bot MAY omit unsupported modules

### 4.2 Discord Control-Plane Runtime Status (Planned, Read-Only)

Target UI:
- Read-only visibility cards within dashboard (no commands)

Conceptual payload (illustrative only — non-authoritative, optional):
```
{
  "platform": "discord",
  "runtime_role": "control-plane",
  "enabled": true,
  "heartbeat": "2025-01-17T09:21:33Z",
  "connection_state": "connected",
  "guild_count": 12,
  "presence": {
    "status_text": "Monitoring",
    "status_emoji": "👀"
  }
}
```

Rules:
- **Planned only**: dashboard consumes this shape when exposed; bots remain authoritative.
- **Read-only**: dashboard MUST NOT issue Discord commands or assume mutability.
- **Optional/Deployment-gated**: absence of Discord status MUST NOT be treated as an error.
- **Non-authoritative**: runtime decides whether to expose any field; omissions imply unknown.

-------------------------------------------------------------------------------

## 5. POLLS MODULE (PHASE 2-READY)

### 5.1 Poll Definition (Dashboard → Bot)

```
{
  "poll_id": "poll_abc123",
  "creator_id": "As5TyU",
  "title": "Which platform?",
  "description": "Vote using !vote <number>",
  "options": [
    { "id": 1, "label": "Rumble" },
    { "id": 2, "label": "YouTube" }
  ],
  "vote_trigger": "!vote",
  "active": true
}
```

Rules:
- Polls are explicitly started and stopped
- Only ONE active poll per creator per platform (v1)
- Vote parsing and tallying is bot-owned
- Dashboard MUST NOT mutate vote counts

---

### 5.2 Poll Runtime State (Bot → Dashboard)

Target UI:
docs/polls/results.html

```
{
  "poll_id": "poll_abc123",
  "title": "Which platform?",
  "description": "Vote using !vote <number>",
  "active": true,
  "options": [
    { "id": 1, "label": "Rumble", "votes": 12 },
    { "id": 2, "label": "YouTube", "votes": 8 }
  ]
}
```

Rules:
- Public page is read-only
- Votes are authoritative from the bot
- Dashboard is a pure rendering surface

-------------------------------------------------------------------------------

## 6. CLIPS MODULE (PHASE 2-READY)

### 6.1 Clip Trigger Definition

```
{
  "trigger": "!clip",
  "duration_seconds": 30,
  "pre_roll_seconds": 10,
  "cooldown_seconds": 120,
  "destination": {
    "platform": "rumble",
    "channel_url": "https://rumble.com/user/clips"
  }
}
```

Rules:
- Clip execution is bot-controlled
- Dashboard only defines rules
- Failures are logged, not retried blindly

-------------------------------------------------------------------------------

## 7. TIER MODEL (AUTHORITATIVE)

### 7.1 Tier Definitions

StreamSuites supports three tiers:

- Open — free, constrained access
- Gold — paid, expanded limits
- Pro — paid, maximum control and branding

Tier is an attribute of a creator and/or account, but is NOT trusted from the dashboard.

---

### 7.2 Tier Enforcement Rules

- Tier policies define LIMITS, not feature forks
- Dashboard expresses intent
- Tier policy clamps intent into effective runtime behavior
- Bot is the sole enforcement authority

Examples:
- Cooldowns may be increased by tier policy
- Clip durations may be reduced by tier policy
- Advanced features may be silently disabled

The dashboard MAY display tier-aware UI hints, but MUST NOT assume enforcement.

---

### 7.3 Custom Identity (Pro Tier)

- Custom bot identity and branding is tier-gated
- Actual availability depends on platform constraints
- Bot MUST silently fall back when unsupported

-------------------------------------------------------------------------------

## 8. DATA DURABILITY & BACKUP RESPONSIBILITIES

### 8.1 Authority

- The bot is the authority for data durability
- The dashboard does not guarantee persistence

---

### 8.2 Backup Scope

The following data MUST be considered backup-eligible:
- Creator configurations
- Chat behaviour / triggers
- Poll definitions and results
- Clip rules
- Runtime job metadata (where applicable)

---

### 8.3 Backup Capabilities

- The bot MAY perform periodic automatic backups
- The bot MUST support manual export of full state
- Backups are opaque blobs to the dashboard
- Restore semantics are bot-owned and version-aware

---

### 8.4 Dashboard Interaction

- Dashboard MAY request exports
- Dashboard MAY download backup artifacts
- Dashboard MUST NOT attempt partial restores

-------------------------------------------------------------------------------

## 9. ERROR & SAFETY RULES

- Bot MUST ignore malformed dashboard configs
- Dashboard MUST reject malformed imports
- No hard crashes on missing fields
- Unknown fields MUST be ignored (forward compatibility)

-------------------------------------------------------------------------------

## 10. VERSIONING

- Contract versions increment ONLY when breaking changes occur
- Schema versions mirror contract versions
- Dashboard and bot must log contract version mismatches

-------------------------------------------------------------------------------

## 11. Chat Log Contracts (Planned)

- The dashboard may consume externally generated chat logs for historical replay.
- Logs may originate from the StreamSuites runtime or compatible exporters.
- Schema compatibility is governed by `schemas/chat_log.schema.json` and matching contract notes here.
- Consumption is read-only: no bot execution, no runtime control, and no authentication requirements.
- Platform-agnostic structure ensures consistent rendering across Rumble, YouTube, Twitch, etc.

---

## 12. DERIVATION RULE (IMPORTANT)

This document is the only place behavior is defined.

From this:
- JSON Schemas are generated
- Validators are implemented
- UI bindings are written
- Bot parsers are written

If something is not in this document:
→ It is not part of the system.
