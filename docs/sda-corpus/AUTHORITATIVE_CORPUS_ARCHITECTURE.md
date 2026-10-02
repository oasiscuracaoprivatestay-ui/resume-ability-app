# Super Diet-Ability (SDA) Authoritative Knowledge Corpus Architecture

**Project:** Super Diet-Ability / Resume-Ability App  
**Author & Originator:** Sergio Laurant  
**Corpus Phase:** Phase 36B  
**Primary Source Directory:** `knowledge/sda-manuscripts/` (Authoritative DOCX Manuscripts)  
**Codebase Root:** `src/coach/knowledge/` and `api/_coach/`

---

## 1. Executive Summary

This architecture establishes a provider-independent, deeply grounded knowledge infrastructure for the SDA AI Coach. The system directly codifies Sergio Laurant’s complete methodology across all seven authoritative manuscripts, seamlessly integrates the application’s actual behavior (screens, workflows, scoring, progression levels 0–10), enforces strict safety boundaries, and maintains source traceability for every piece of coaching knowledge.

---

## 2. Source Authority Hierarchy

To prevent hallucinations, generic diet cliches, or ungrounded advice, the SDA knowledge architecture strictly adheres to a four-tier authority hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 1 — AUTHORITATIVE SDA METHODOLOGY                    │
│  The 7 Sergio Laurant Manuscripts (Books 1 to 7)           │
│  (Resume-Ability, Loss-Maintenance, Appetite-Fix,           │
│   Insulin-Aware, Keto-Switching, Circadian, Micro-Fasting)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│  LEVEL 2 — AUTHORITATIVE APPLICATION BEHAVIOR               │
│  The Actual Implemented App Logic, Screens & Rules          │
│  (Scoring Engine, Levels 0-10, XP, Food Log, Neutral Log,   │
│   Daily Review, Commitment, Slippery Zones, Timer, Caps)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│  LEVEL 3 — DERIVED KNOWLEDGE                                │
│  Granular Knowledge Units, Terminology Index,               │
│  Semantic Guardrails & Multi-Dimensional Retrieval Engine   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│  GENERAL MODEL KNOWLEDGE                                    │
│  Used for language syntax, reasoning, and conversational   │
│  tone ONLY. NEVER overrides Levels 1 or 2.                  │
└─────────────────────────────────────────────────────────────┘
```

- **Level 1 (Authoritative Manuscripts):** Absolute authority on SDA philosophy, behavioral mechanisms, physiological models, and ability definitions.
- **Level 2 (Authoritative App Behavior):** Absolute authority on what the app actually does, how points are awarded, how levels progress, and what screens exist.
- **Level 3 (Derived Knowledge):** Indexed summaries and retrieval units derived 1-to-1 from Levels 1 and 2.
- **General Model Knowledge:** Permitted only for conversational phrasing. If an SDA-specific answer cannot be supported by Levels 1 or 2, the system returns a `KnowledgeGap` rather than substituting generic diet advice.

---

## 3. The Seven Authoritative Manuscripts Inventory

All seven manuscripts have been completely parsed, verified, and mapped to canonical Diet-Ability IDs:

| Book # | Detected Filename | Official Title | Subtitle | Parts | Chapters | Canonical Ability ID |
|---|---|---|---|:---:|:---:|---|
| **Book 1** | `SDA_Book_01_Resume-Ability.docx` | **Resume-Ability** | *The Skill That Keeps You Consistent on Any Diet* | 1 | 25 | `resume_ability` |
| **Book 2** | `SDA_Book_02_Loss-Maintenance-Ability.docx` | **Loss-Maintenance Ability** | *The Umbrella Ability / Why Maintenance Comes Before Fat Loss* | 4 | 17 | `loss_maintenance_ability` |
| **Book 3** | `SDA_Book_03_Appetite-Fix-Ability.docx` | **Appetite-Fix Ability** | *Retrain Your Hunger. Reclaim Your Freedom.* | 4 | 14 | `appetite_fix_ability` |
| **Book 4** | `SDA_Book_04_Insulin-Aware-Ability.docx` | **Insulin-Aware Ability** | *Understand the Signal. Make Better Decisions.* | 4 | 18 | `insulin_aware_ability` |
| **Book 5** | `SDA_Book_05_Keto-Switching-Ability.docx` | **Keto-Switching Ability** | *Train Your Body to Move From Incoming Energy to Stored Energy* | 5 | 25 | `keto_switching_ability` |
| **Book 6** | `SDA_Book_06_Circadian-Eating-Ability.docx` | **Circadian Eating Ability** | *Align Your Eating With the Rhythm of Your Body* | 6 | 30 | `circadian_eating_ability` |
| **Book 7** | `SDA_Book_07_Micro-Fasting-Ability.docx` | **Micro-Fasting Ability** | *Build Longer Fasts One Manageable Block at a Time* | 9 | 47 | `micro_fasting_ability` |
| **TOTAL** | **7 Books** | **Super Diet-Ability Series** | **By Sergio Laurant** | **33** | **176** | **All 7 Diet-Abilities** |

---

## 4. Canonical Seven Diet-Abilities Overview

1. **Resume-Ability (`resume_ability`):**
   - *Core Concept:* The capacity to pause between feeling and action, returning to structure immediately without restarting.
   - *Key Tools:* The 15-Minute Resume Method, Five Types of Slips, Slippery Zone terrain mapping, Seven Signals early warning system, Core Flow (Feel, Pause, Choose, Resume).
2. **Loss-Maintenance Ability (`loss_maintenance_ability`):**
   - *Core Concept:* The central umbrella ability; maintenance begins with the first pound lost, not at the end.
   - *Key Tools:* The Fat-Loss Duet (alternating deficit and maintenance phases), 80/20 Principle (intentional flexibility buffer), Whole Foods Foundation, Non-Negotiables as anchors.
3. **Appetite-Fix Ability (`appetite_fix_ability`):**
   - *Core Concept:* Retraining hunger signals and resetting the appetite thermostat. Appetite is not broken; hunger is not an emergency.
   - *Key Tools:* Satiety Toolbox (Protein, fiber, volume, chewing density), Seven Appetite Disruptors audit, Cravings as dopamine predictions rather than commands, Fixing the meal before fighting the gap.
4. **Insulin-Aware Ability (`insulin_aware_ability`):**
   - *Core Concept:* Insulin as a vital anabolic messenger rather than an enemy to fear. Focusing on insulin sensitivity rather than zero-carb phobia.
   - *Key Tools:* Insulin-Aware Plate (protein + fiber + healthy carbs), Label-Reading Ability (ignoring health halos), Liquid Calorie Elimination, Clean Metabolic Pauses between meals.
5. **Keto-Switching Ability (`keto_switching_ability`):**
   - *Core Concept:* Metabolic flexibility—training the body to transition smoothly between incoming food energy and stored body energy.
   - *Key Tools:* The Switching Ladder (3 meals → 4h gaps → overnight gap → extended fast), Firm Meal Boundaries (the final bite starts the switch), Post-meal walking as a glucose switch, Home environment audit.
6. **Circadian Eating Ability (`circadian_eating_ability`):**
   - *Core Concept:* Aligning eating with the 24-hour endogenous metabolic clock. Nutrient timing changes hormonal processing.
   - *Key Tools:* The Three Phases (Eating Phase, Clearing Phase [2–4h before bed], Overnight Gap [12h natural baseline]), Late-night eating remediation (fixing daytime under-eating), Shift work protocols, Medical hierarchy primacy.
7. **Micro-Fasting Ability (`micro_fasting_ability`):**
   - *Core Concept:* The capstone ability; building, protecting, and extending spaces between meals using progressive 15-minute blocks.
   - *Key Tools:* The 15-Minute Block, The Craving Block, Micro-Fasting Ladder (12h → 14h → 16h → 20h → 24h), Readiness before duration, Pre-decided Stop Rules, Refeeding protocol, Default Five Non-Negotiables.

### Multi-Ability Architecture
The seven Diet-Abilities reside under the `'diet'` domain within Sergio Laurant's overarching Super Ability ecosystem (`diet`, `productivity`, `time-management`, `organizer`, `money`, `entrepreneurship`). Non-diet abilities are tracked as `APP_RESERVED`.

---

## 5. App Knowledge Layer (Level 2)

The AI Coach possesses complete, verified knowledge of our own application:
- **Screens & Navigation:** Home, Daily Check-In, Structured Diet, Food Log, Neutral Log, Slip Reporting, Re-Commit, Timer, Daily Review, Commitment, Why, Non-Negotiables, Slippery Zones, Settings, Sound & Haptics.
- **Scoring Engine:**
  - Base points: `DAY_START` (+10 pts, max 1/day).
  - Positive reporting: `SLIP_REPORTED` (+8 pts, max 5/day), `RECOMMIT` (+15 pts, max 2/day).
  - Adherence: `DIET_ON_TRACK` (+8 pts, max 10/day), `DIET_TWENTY_PERCENT_OFF_TRACK` (+5 pts, max 10/day).
  - Reviews: `DAILY_REVIEW_COMPLETE` (+40 pts, max 1/day), `COMMITMENT_COMPLETE` (+20 pts, max 1/day), `NON_NEGOTIABLES_REVIEW` (+15 pts, max 1/day), `SLIPPERY_ZONES_REVIEW` (+15 pts, max 1/day).
  - Points NEVER decrease. Slips never deduct points or reset lifetime XP.
- **Progression Engine:** Levels 0 to 10. Highest level achieved is permanent. Missing a day resets the current streak only.
- **Storage & Privacy:** Pure local offline architecture via `localStorage`. Zero telemetry, zero external tracking.
- **Feature Status Tracking:**
  - `APP_CURRENT`: Actively available and implemented in the current build.
  - `APP_PLANNED`: Cloud sync, CGM wearable direct integration, interactive voice coaching.
  - `APP_RESERVED`: Super Productivity, Time-Management, Organizer, Money, Entrepreneurship.

---

## 6. Safety Model & Medical Primacy

Safety strictly supersedes all dietary coaching, fasting goals, and circadian schedules:
1. **Pre-Decided Stop Rules (Book 7 Ch 29):**
   - Fasting terminates IMMEDIATELY if the user experiences dizziness, syncope/fainting, confusion, severe/progressive weakness, substantial tremors/shaking, chest pain, shortness of breath, palpitations, or persistent vomiting.
   - User is instructed to sit/lie down, consume electrolytes/fluids, break the fast with gentle nutrition, and seek immediate medical evaluation if chest pain or severe symptoms persist.
2. **Absolute Contraindications (Book 7 Ch 28):**
   - Extended fasting is contraindicated for pregnant women, breastfeeding mothers, minors under 18, and individuals with an active or historical eating disorder.
3. **Medication Primacy (Book 6 Ch 23 & Book 4 Ch 4):**
   - Medical prescriptions and doctor orders strictly override any dietary schedule or fasting window.
   - The Coach NEVER diagnoses medical conditions, NEVER alters prescription dosages, and NEVER provides individualized medical clearance.

---

## 7. Multi-Dimensional Retrieval Engine

To avoid overwhelming AI models with large raw text dumps, retrieval is bounded and deterministic:
- **Retrieval Engine (`src/coach/knowledge/retrieval/sdaRetrievalEngine.ts`):**
  - Evaluates user query text, active ability, detected intent, semantic tags, and app feature context.
  - Prioritizes Safety Protocols if concerning keywords or symptoms are detected.
  - Supports cross-ability multi-dimensional retrieval (e.g. fasting + slip returns both Micro-Fasting and Resume-Ability units).
  - Limits results to top 3–5 bounded knowledge units to preserve token economy and prevent latency degradation.
  - Detects out-of-scope fad diets (cabbage soup, blood type, carnivore, etc.) and routes them to a `KnowledgeGap`.
- **Future Vector / RAG Upgrade Path:**
  - Every knowledge unit is assigned a stable unique ID (`sda_b01_ch01_...`), rich semantic metadata, and source references.
  - The deterministic retrieval engine serves as a drop-in contract that can seamlessly integrate vector embeddings (e.g. text-embedding-3-small) in future server phases without altering client contracts.

---

## 8. Proprietary Content Protection & Privacy

1. **Immutable Source Manuscripts:** The original DOCX files in `knowledge/sda-manuscripts/` are immutable source documents.
2. **Zero Public Assets:** Manuscripts are never placed in `/public/` or `/dist/`.
3. **No Verbatim Dumps:** Knowledge units distill and synthesize methodology; no entire chapters or raw DOCX files are ever transmitted to the browser or returned verbatim in API responses.
4. **Server-Safe Security:** Remote AI gateway keys (`AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`) remain server-side only in Vercel environment variables.
