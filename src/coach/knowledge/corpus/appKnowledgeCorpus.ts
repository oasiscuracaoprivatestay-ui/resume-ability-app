/**
 * SDA Authoritative Knowledge Corpus — Application Knowledge Layer (Phase 36B.1)
 *
 * Source: Actual implemented application code (Level 2 — Authoritative Application Behavior).
 * Audited against current screens, components, and storage engines:
 * - HomeScreen.tsx, CheckInScreen.tsx, StructuredDietScreen.tsx, DietVerificationScreen.tsx,
 *   SlipTypeScreen.tsx, DailyReviewScreen.tsx, TimerScreen.tsx, CoachScreen.tsx.
 *
 * Strict Source Authority:
 * - APP_EXPLICIT: Implemented and fully verified in current codebase.
 * - APP_PLANNED / APP_RESERVED: Future functionality; Coach must never state they exist today.
 */

import type { AppKnowledgeUnit } from '../types';

export const APP_KNOWLEDGE_UNITS: AppKnowledgeUnit[] = [
  {
    id: 'app_feat_home',
    featureKey: 'home_dashboard',
    name: 'Home Dashboard Screen',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'home',
    description:
      'The central dashboard displaying the daily score, lifetime XP, current progression level (0-10), active streak counter, active Structured Diet schedule preview, Daily Check-In launch button, quick resume action, and floating navigation.',
    userActions: [
      'View daily score, level, and streak',
      'Launch Daily Check-In',
      'Quick report a slip or start resume timer',
      'Navigate to Structured Diet, Food Log, or Coach',
    ],
    scoringEvent: 'DAY_START',
    pointsAwarded: 10,
    dailyCap: 1,
    persistence: 'localStorage (sda_scoring_store, sda_streak_store)',
    relatedDietAbilities: ['resume_ability', 'loss_maintenance_ability'],
    coachingGuidance:
      'Guide the user to the Home screen for an overview of their daily progress, streak, and quick access to core tools.',
  },

  {
    id: 'app_feat_daily_check_in',
    featureKey: 'daily_check_in',
    name: 'Daily Check-In',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'check-in',
    description:
      'A deliberate mindfulness touchpoint featuring a hold-to-confirm ring (2.5 seconds) to cultivate presence. The user registers their current status (on-structure, near-slip, or slip). If near-slip or slip, support options appear (Pause with Timer, Review Structure, Reach Out). Users then review and confirm their personal non-negotiables, earning +10 points.',
    userActions: [
      'Hold the presence ring (2.5 seconds) to ground attention',
      'Select status: On-Structure, Near-Slip, or Slip',
      'Review and check off committed non-negotiables',
      'Earn +10 points upon completion',
    ],
    scoringEvent: 'DAILY_CHECK_IN',
    pointsAwarded: 10,
    dailyCap: 1,
    persistence: 'localStorage (sda_check_in_storage)',
    relatedDietAbilities: ['resume_ability', 'loss_maintenance_ability'],
    coachingGuidance:
      'Encourage regular check-ins to build mindful awareness and reinforce committed non-negotiables. Note that Check-In does not evaluate hunger scales or require multiple fixed daily slots.',
  },

  {
    id: 'app_feat_structured_diet',
    featureKey: 'structured_diet_management',
    name: 'Structured Diet Screen',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'structured-diet',
    description:
      'Screen for defining, reviewing, and customizing the user’s personal eating schedule, meal windows, food categories, and non-negotiables. Includes a timeline of planned meals and direct access to the Neutral Log.',
    userActions: [
      'Configure eating windows (e.g. 12:00 to 20:00)',
      'Set target meals and scheduled blocks',
      'Review structure rules (+10 points once daily)',
      'Open Neutral Log modal to record non-evaluative entries',
    ],
    scoringEvent: 'STRUCTURED_DIET_REVIEW',
    pointsAwarded: 10,
    dailyCap: 1,
    persistence: 'localStorage (sda_structured_diet)',
    relatedDietAbilities: ['loss_maintenance_ability', 'circadian_eating_ability', 'insulin_aware_ability'],
    coachingGuidance:
      'Remind users that their Structured Diet is their chosen baseline, which they can adjust anytime life circumstances change.',
  },

  {
    id: 'app_feat_food_log',
    featureKey: 'food_logging',
    name: 'Food Log & Outcome Classification',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'food_log',
    description:
      'Meal logging where users record meal times, food categories (protein, vegetables, complex carbs, simple carbs, fats, fruits, snacks, desserts, beverages, soups), and classify the outcome: On Track (+8 pts), Adjusted and On Track (+8 pts), 20% OFF TRACK (+5 pts, acceptable flexibility), Structured Slip (+8 pts), or Unstructured Slip (+8 pts). Honest slip reporting is rewarded identically to on-track eating to eliminate shame.',
    userActions: [
      'Log meal times and select food categories',
      'Select outcome (On Track, 20% Off Track, Slip)',
      'Add optional meal descriptions or notes',
    ],
    scoringEvent: 'DIET_ON_TRACK / DIET_TWENTY_PERCENT_OFF_TRACK / DIET_SLIP',
    pointsAwarded: 8,
    dailyCap: 10,
    persistence: 'localStorage (dietVerificationStorage)',
    relatedDietAbilities: ['loss_maintenance_ability', 'resume_ability', 'insulin_aware_ability'],
    coachingGuidance:
      'Praise honest logging regardless of outcome. Point out that 20% OFF TRACK is an acceptable flexibility buffer, not a failure, and slips earn points for honesty. Clarify that 20% OFF TRACK represents intentional lifestyle flexibility and has zero connection to carbohydrate percentages or macro formulas.',
  },

  {
    id: 'app_feat_neutral_log',
    featureKey: 'neutral_log',
    name: 'Neutral Log',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'structured-diet (modal)',
    description:
      'A flexible, non-evaluative registration mechanism accessible from the Structured Diet screen. Allows the user to record any entry (description, date, start/end time, optional amount/unit) that they want to capture without forcing food category classification or dietary outcome evaluation (on track vs slip). Carries ZERO point awards and ZERO dietary scoring to maintain complete neutrality.',
    userActions: [
      'Open Neutral Log modal from Structured Diet',
      'Enter custom description (e.g. water, electrolytes, vitamins, coffee, or notes)',
      'Record start and end times and optional quantity',
      'Save non-evaluative record with zero dietary judgment or score impact',
    ],
    persistence: 'localStorage (dietVerificationStorage with isNeutral: true)',
    relatedDietAbilities: ['loss_maintenance_ability', 'resume_ability'],
    coachingGuidance:
      'Explain that the Neutral Log is a safe, judgment-free space to record items or activities without assigning dietary pass/fail outcomes or scoring points. It is not limited to vitamins or medications, nor does it monitor medical adherence.',
  },

  {
    id: 'app_feat_slip_reporting_and_resume',
    featureKey: 'slip_reporting_flow',
    name: 'Slip Reporting & Re-Commitment Flow',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'slip-type',
    description:
      'A dedicated multi-step recovery flow: 1) Report slip honestly (+8 pts, no point deduction); 2) Classify slip context (slippery zone vs non-negotiable); 3) View constructive insights; 4) Recommit (+15 pts) and optionally launch the 15-minute resume timer. Total +23 points awarded for recovering.',
    userActions: [
      'Report slip without penalty',
      'Select slip context and triggers',
      'Re-commit to structure (+15 pts)',
      'Optionally launch 15-minute resume timer',
    ],
    scoringEvent: 'SLIP_REPORTED (+8 pts) & RECOMMIT (+15 pts)',
    pointsAwarded: 23,
    dailyCap: 5,
    persistence: 'localStorage (dietVerificationStorage, scoringStore)',
    relatedDietAbilities: ['resume_ability'],
    coachingGuidance:
      'Walk users through this flow immediately after an off-plan choice. Emphasize that reporting and recommitting earn more points (+23 pts total) than an on-track meal, proving that recovery is celebrated.',
  },

  {
    id: 'app_feat_daily_review',
    featureKey: 'daily_review',
    name: 'Daily Review & Evening Reflection',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'daily-review',
    description:
      'End-of-day reflection screen where the user reviews slippery zones encountered, confirms non-negotiables upheld, evaluates wins, and closes the day. Completing the review awards +40 points once daily.',
    userActions: [
      'Reflect on daytime eating and challenges',
      'Review slippery zones encountered and non-negotiables',
      'Earn +40 points (once per day)',
    ],
    scoringEvent: 'DAILY_REVIEW_COMPLETE',
    pointsAwarded: 40,
    dailyCap: 1,
    persistence: 'localStorage (sda_daily_review_store)',
    relatedDietAbilities: ['loss_maintenance_ability', 'circadian_eating_ability', 'resume_ability'],
    coachingGuidance:
      'Encourage completing the Daily Review before bed to achieve psychological closure on the day.',
  },

  {
    id: 'app_feat_timer',
    featureKey: 'urge_and_fasting_timer',
    name: '15-Minute Urge & Fasting Timer',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'timer',
    description:
      'Interactive circular countdown timer supporting three modes: single 15-minute urge container, loop timer (progressive 15-minute stacking), and extended fast countdown timer with audio feedback. Completing a timer session awards +10 points (max 2/day).',
    userActions: [
      'Start 15-minute urge pause',
      'Stack blocks in loop mode (15m, 30m, 45m, 60m)',
      'Run extended fasting countdown',
      'Complete timer session and earn +10 points',
    ],
    scoringEvent: 'TIMER_COMPLETED',
    pointsAwarded: 10,
    dailyCap: 2,
    persistence: 'localStorage (timerState)',
    relatedDietAbilities: ['resume_ability', 'micro_fasting_ability'],
    coachingGuidance:
      'Guide users to the Timer whenever an urge strikes or when bridging the space between meals. Note that the timer does not automate medical alerts or complex refeeding flows.',
  },

  {
    id: 'app_feat_scoring_progression',
    featureKey: 'scoring_engine_and_levels',
    name: 'Scoring Engine & Level Progression (0 to 10)',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'home',
    description:
      'System-wide gamification engine where points accumulate into Lifetime XP. Levels range from Level 0 to Level 10. Points are NEVER deducted; slips never penalize score; highest level achieved is permanent. Missing a day resets the current streak only.',
    userActions: [
      'Earn points for positive behavioral engagement',
      'Progress through levels 0 to 10',
      'Track current and longest streaks',
    ],
    persistence: 'localStorage (sda_score_store, sda_progression_store)',
    relatedDietAbilities: ['resume_ability', 'loss_maintenance_ability'],
    coachingGuidance:
      'Assure users that their score and level are safe forever. The app never subtracts points or punishes slips.',
  },

  {
    id: 'app_feat_ai_coach',
    featureKey: 'sda_ai_coach',
    name: 'SDA AI Coach',
    status: 'APP_CURRENT',
    sourceAuthority: 'APP_EXPLICIT',
    screen: 'coach',
    description:
      'Sergio Laurant’s AI Coach grounded in the 7 SDA manuscripts and app functionality. Provides conversational guidance, urge recovery, educational explanations, and action proposals. Operates on a preview-only confirmation model (ZERO direct application data mutation).',
    userActions: [
      'Ask questions about SDA methodology and books',
      'Get coaching support during an urge or after a slip',
      'Receive action proposals (e.g. navigate to log, start timer) that require user confirmation',
    ],
    persistence: 'localStorage (coach_conversation_store)',
    relatedDietAbilities: [
      'resume_ability',
      'loss_maintenance_ability',
      'appetite_fix_ability',
      'insulin_aware_ability',
      'keto_switching_ability',
      'circadian_eating_ability',
      'micro_fasting_ability',
    ],
    coachingGuidance:
      'Coach acts as an empathetic, calm, non-shaming guide following Sergio Laurant’s principles.',
  },

  // ── Planned Features (Must NOT be described as currently existing) ──────────

  {
    id: 'app_feat_cloud_sync_planned',
    featureKey: 'cloud_sync_backup',
    name: 'Multi-Device Cloud Sync',
    status: 'APP_PLANNED',
    sourceAuthority: 'RESERVED',
    description:
      'Future capability to securely synchronize local logs and scores across multiple mobile devices via encrypted backend accounts.',
    userActions: ['Account registration', 'Multi-device sync'],
    persistence: 'Planned cloud database',
    relatedDietAbilities: ['loss_maintenance_ability'],
    coachingGuidance:
      'If a user asks about multi-device syncing or logging in from another phone, clarify that cloud sync is planned for a future release; currently, all data is stored privately on their local device.',
  },

  {
    id: 'app_feat_cgm_wearable_planned',
    featureKey: 'cgm_wearable_integration',
    name: 'Continuous Glucose Monitor (CGM) Direct Integration',
    status: 'APP_PLANNED',
    sourceAuthority: 'RESERVED',
    description:
      'Future capability to automatically ingest real-time interstitial glucose readings from Dexcom / Freestyle Libre sensors.',
    userActions: ['Connect sensor API', 'View live glucose curves'],
    persistence: 'Planned wearable integration',
    relatedDietAbilities: ['insulin_aware_ability', 'keto_switching_ability'],
    coachingGuidance:
      'If a user asks if their Dexcom or Apple Health glucose connects directly to the app, explain that direct CGM integration is planned for a future phase; the app currently does not connect to CGM hardware.',
  },

  {
    id: 'app_feat_voice_coaching_planned',
    featureKey: 'voice_interactive_coaching',
    name: 'Interactive Voice Coaching',
    status: 'APP_PLANNED',
    sourceAuthority: 'RESERVED',
    description:
      'Future capability for real-time bidirectional voice coaching with audio turn-taking.',
    userActions: ['Voice conversation'],
    persistence: 'Planned voice gateway',
    relatedDietAbilities: ['resume_ability'],
    coachingGuidance:
      'If a user asks about talking via voice, clarify that voice coaching is planned for a future phase; the coach is currently text-based.',
  },

  // ── Reserved Non-Diet Domains (Super Ability Ecosystem) ────────────────────

  {
    id: 'app_feat_reserved_productivity',
    featureKey: 'super_productivity_ability',
    name: 'Super Productivity-Ability',
    status: 'APP_RESERVED',
    sourceAuthority: 'RESERVED',
    description: 'Future Super Ability application focused on deep work, focus blocks, and cognitive stamina.',
    userActions: [],
    persistence: 'Future ecosystem',
    relatedDietAbilities: [],
    coachingGuidance:
      'Acknowledge as a future pillar of the Super Ability ecosystem by Sergio Laurant, outside the current Diet domain.',
  },
];
