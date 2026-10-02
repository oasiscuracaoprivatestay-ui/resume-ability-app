/**
 * Manuscript to Application Feature Mappings (Phase 36B.1)
 *
 * Provides authoritative mapping between Sergio Laurant's manuscript concepts
 * and actual application capabilities.
 *
 * Relationship Types:
 * - DIRECT_IMPLEMENTATION: App directly provides this exact mechanism. Coach can say: "You can use [feature] for this."
 * - SUPPORTING_TOOL: App provides a supportive tool facilitating this practice.
 * - RELATED_CONTEXT: Relevant conceptual context, but no standalone active tool.
 * - FUTURE_OPPORTUNITY: Planned future capability. MUST NEVER be described as currently existing.
 */

import type { ManuscriptAppMapping } from '../types';

export const MANUSCRIPT_APP_MAPPINGS: ManuscriptAppMapping[] = [
  {
    manuscriptConcept: '15-Minute Resume Method / Delay Container',
    sourceBook: 1,
    sourceChapter: 11,
    appFeature: 'urge_and_fasting_timer',
    relationshipType: 'DIRECT_IMPLEMENTATION',
    description:
      'The 15-minute urge container in the app directly executes Sergio Laurant’s 15-minute delay method to decouple urge from automatic eating.',
  },
  {
    manuscriptConcept: 'Structured Diet Definition and Boundaries',
    sourceBook: 2,
    sourceChapter: 3,
    appFeature: 'structured_diet_management',
    relationshipType: 'DIRECT_IMPLEMENTATION',
    description:
      'The Structured Diet screen directly lets users set meal windows, planned meals, food categories, and non-negotiables.',
  },
  {
    manuscriptConcept: 'Honest Slip Reporting and Immediate Recovery',
    sourceBook: 1,
    sourceChapter: 23,
    appFeature: 'slip_reporting_flow',
    relationshipType: 'DIRECT_IMPLEMENTATION',
    description:
      'The slip reporting flow awards points for honest reporting without deduction (+8 pts) and recommitting (+15 pts), enacting Sergio’s recovery doctrine.',
  },
  {
    manuscriptConcept: '80/20 Consistency Principle (Intentional Flexibility Buffer)',
    sourceBook: 2,
    sourceChapter: 4,
    appFeature: 'food_logging',
    relationshipType: 'DIRECT_IMPLEMENTATION',
    description:
      'Derived from Sergio Laurant’s 80/20 principle (Book 1 Ch 13 & Book 2 Ch 4). The app operationalizes this as the "20% OFF TRACK" meal outcome (+5 pts, On Track, never a slip). It represents conscious lifestyle flexibility, NEVER a carbohydrate percentage or macro ratio.',
  },
  {
    manuscriptConcept: 'Non-Negotiables Identification and Review',
    sourceBook: 2,
    sourceChapter: 13,
    appFeature: 'daily_check_in',
    relationshipType: 'SUPPORTING_TOOL',
    description:
      'Daily Check-In prompts the user to review and confirm their personal committed non-negotiables after holding the presence ring.',
  },
  {
    manuscriptConcept: 'Slippery Zones Recognition & Evening Reflection',
    sourceBook: 1,
    sourceChapter: 7,
    appFeature: 'daily_review',
    relationshipType: 'SUPPORTING_TOOL',
    description:
      'Daily Review prompts evening reflection on slippery zones encountered during the day to prevent repeat slips.',
  },
  {
    manuscriptConcept: 'Flexible Non-Evaluative Registration',
    sourceBook: 1,
    sourceChapter: 1,
    appFeature: 'neutral_log',
    relationshipType: 'SUPPORTING_TOOL',
    description:
      'The Neutral Log modal in Structured Diet provides a non-evaluative recording mechanism with zero dietary judgment or scoring.',
  },
  {
    manuscriptConcept: 'Micro-Fasting Progressive Blocks',
    sourceBook: 7,
    sourceChapter: 20,
    appFeature: 'urge_and_fasting_timer',
    relationshipType: 'SUPPORTING_TOOL',
    description:
      'The timer supports 15-minute loop mode stacking and countdown sessions to support progressive fasting practice.',
  },
  {
    manuscriptConcept: 'Circadian Overnight Gap / Time-Restricted Eating',
    sourceBook: 6,
    sourceChapter: 5,
    appFeature: 'structured_diet_management',
    relationshipType: 'RELATED_CONTEXT',
    description:
      'Structured eating windows establish the overnight gap, though the app does not automatically measure continuous bio-gaps.',
  },
  {
    manuscriptConcept: 'Real-Time Continuous Glucose Monitoring (CGM)',
    sourceBook: 4,
    sourceChapter: 2,
    appFeature: 'cgm_wearable_integration',
    relationshipType: 'FUTURE_OPPORTUNITY',
    description:
      'Direct CGM sensor integration is a future roadmap item; the current app does not ingest live sensor streams.',
  },
  {
    manuscriptConcept: 'Interactive Bidirectional Voice Coaching',
    sourceBook: 1,
    sourceChapter: 25,
    appFeature: 'voice_interactive_coaching',
    relationshipType: 'FUTURE_OPPORTUNITY',
    description:
      'Real-time voice turn-taking coaching is a planned future capability; the current coach operates as text-based chat.',
  },
  {
    manuscriptConcept: 'Multi-Device Encrypted Cloud Sync',
    sourceBook: 2,
    sourceChapter: 1,
    appFeature: 'cloud_sync_backup',
    relationshipType: 'FUTURE_OPPORTUNITY',
    description:
      'Cloud sync is planned for a future phase; current user logs are stored locally on device.',
  },
];
