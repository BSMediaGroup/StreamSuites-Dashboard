# StreamSuites — Tier Policy
Version: v1.0
Status: Authoritative Policy Document

This document defines the **tiered access model** for StreamSuites.

It specifies:
- What features are available at each tier
- What limits apply
- What capabilities are restricted or expanded

This document is **policy-only**.
No implementation details, logic, or enforcement mechanisms belong here.

If behavior, schemas, or code conflict with this document,
THIS DOCUMENT WINS.

---

## 1. CORE PRINCIPLES

### 1.1 Tier-Based Capability Model
- Every creator is assigned exactly ONE tier
- Tiers define **capabilities**, not implementations
- Features MUST degrade gracefully when unavailable
- Higher tiers MUST be strict supersets of lower tiers

---

### 1.2 Separation of Concerns
- Tier rules define WHAT is allowed
- Schemas define WHAT is valid
- Bots enforce WHAT is permitted
- Dashboards only DISPLAY availability and limits

No layer may redefine tier meaning independently.

---

### 1.3 Forward Compatibility
- New tiers MAY be added
- Existing tier guarantees MUST NOT be broken
- Unknown tier fields MUST be ignored safely

---

## 2. TIER DEFINITIONS

### 2.1 Open Tier (Free)

**Purpose**
- Default entry tier
- Public, frictionless onboarding
- Safe baseline for experimentation

**Characteristics**
- Shared bot identity
- Conservative rate limits
- Core functionality only

**Guaranteed Access**
- Chat triggers (basic)
- Polls (single active poll)
- Clip creation (short duration)
- Dashboard configuration
- Manual import/export of configuration

**Restrictions**
- Longer cooldowns
- Shorter clip durations
- No custom bot identity
- No advanced automation
- No background backups

---

### 2.2 Gold Tier (Paid – Mid Level)

**Purpose**
- Power users
- Increased automation and flexibility
- Reduced friction

**Characteristics**
- Preferential limits
- Expanded feature access
- Improved responsiveness

**Guaranteed Access**
- Everything in Open Tier
- Reduced cooldowns
- Longer clip durations
- Multiple concurrent polls (limited)
- Increased trigger density
- Priority feature availability

**Restrictions**
- Shared branding (no custom bot identity)
- Limited automation scope
- No per-creator isolated bot runtime

---

### 2.3 Pro Tier (Paid – Advanced)

**Purpose**
- Professional creators
- Brand-centric usage
- Maximum flexibility and control

**Characteristics**
- Minimal limits
- Customisation
- Isolation where supported

**Guaranteed Access**
- Everything in Gold Tier
- Custom bot identity (where platform allows)
- Near-zero or zero cooldowns (within platform rules)
- Long-form clips
- Advanced automation
- Dedicated or isolated bot identity (logical or physical)
- Automated scheduled backups
- Admin-level export access

**Restrictions**
- Platform limitations still apply
- Abuse prevention rules remain enforced

---

## 3. FEATURE DIMENSIONS (POLICY AXES)

Tiers are evaluated across the following **capability axes**.

These axes are **conceptual** and MUST NOT imply implementation.

---

### 3.1 Chat Triggers
- Maximum number of triggers
- Minimum cooldowns
- Trigger execution rate
- Complexity of match rules (future)

---

### 3.2 Clips
- Maximum clip duration
- Minimum cooldown
- Concurrent clip jobs
- Destination flexibility

---

### 3.3 Polls
- Concurrent active polls
- Poll duration
- Voting frequency
- Result visibility scope

---

### 3.4 Bot Identity & Branding
- Shared vs custom identity
- Custom bot name
- Custom avatar (where supported)
- Platform-specific identity overrides

---

### 3.5 Automation
- Scheduled tasks
- Background jobs
- Automated posting
- Conditional workflows

---

### 3.6 Data & Backups
- Manual export availability
- Automated backup frequency
- Retention duration
- Admin-initiated restore access

---

## 4. BACKUP & DATA POLICY

### 4.1 Ownership
- All creator configuration data is user-owned
- StreamSuites acts as a steward, not an owner

---

### 4.2 Backup Types

**Manual Backups**
- User-initiated
- Explicit export action
- Available to all tiers

**Automated Backups**
- Tier-dependent
- Frequency and retention defined by tier
- Optional for Open / Gold
- Guaranteed for Pro

---

### 4.3 Restore Rules
- Restore actions are privileged
- Restore capability MAY be tier-restricted
- Dashboards MAY expose restore controls conditionally

---

## 5. ENFORCEMENT RULES

- Tiers are enforced exclusively by runtime bots
- Dashboards MUST NOT simulate enforcement
- Dashboards MAY visually indicate restrictions
- Bots MUST fail safely on tier violations
- Violations MUST NOT crash the runtime

---

## 6. RELATION TO OTHER DOCUMENTS

This document is upstream of:
- CONTRACTS.md
- JSON Schemas
- Bot enforcement logic
- Dashboard feature gating

All tier schemas, validators, and enforcement layers
MUST be derived from this document.

---

## 7. VERSIONING

- Tier policy versions increment on breaking changes
- New capabilities MAY be added without breaking version
- Removal or restriction of guarantees REQUIRES a major version

---

## 8. FINAL AUTHORITY

If a feature is not explicitly allowed here:
→ It is not guaranteed.

If a tier does not mention a capability:
→ Assume the most restrictive interpretation.

This document defines what StreamSuites IS allowed to do.
Everything else is implementation detail.
