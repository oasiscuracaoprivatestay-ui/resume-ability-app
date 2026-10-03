/**
 * SDA AI Coach — Centralized Terminology Registry (Phase 35)
 *
 * Source-grounded definitions for all canonical SDA concepts.
 * Each entry includes its authoritative status, short definition,
 * source reference, and semantic relationships.
 */

import type { SDATerm, SDATermKey } from './types';

export const SDA_TERMINOLOGY: Record<SDATermKey, SDATerm> = {
  super_diet_ability: {
    key: 'super_diet_ability',
    displayName: 'Super Diet-Ability',
    shortDefinition: 'The core system of building deep behavioral capacity around food through awareness, structure, and resume capability.',
    fullExplanation: 'Super Diet-Ability (SDA) is not a restrictive diet, but a behavioral skill framework focused on building personal dietary mastery, observing structure, and mastering the return after slips.',
    relatedTerms: ['sda', 'resume_ability', 'structured_diet', 'structure'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts',
  },

  sda: {
    key: 'sda',
    displayName: 'SDA',
    shortDefinition: 'Abbreviation for Super Diet-Ability.',
    relatedTerms: ['super_diet_ability', 'resume_ability'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts',
  },

  resume_ability: {
    key: 'resume_ability',
    displayName: 'Resume-Ability',
    shortDefinition: 'The core capacity to pause between feeling and action, and return to your structure at any point after a slip.',
    fullExplanation: 'Resume-Ability is the foundational superpower in the SDA system. It shifts focus from avoiding all mistakes to drastically shortening the time and emotional cost of returning to your plan.',
    relatedTerms: ['super_diet_ability', 'resume', 'structured_slip', 'unstructured_slip'],
    status: 'defined',
    sourceRef: 'SDA_Book_01_Resume-Ability.docx; app_terminology:sda_term_ra',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },


  appetite_ability: {
    key: 'appetite_ability',
    displayName: 'Appetite Ability [Deprecated Alias]',
    shortDefinition: '[Deprecated alias for Appetite-Fix Ability] Use canonical appetite_fix_ability instead.',
    fullExplanation: 'Deprecated in Phase 38. The authoritative manuscript audit established that Sergio Laurant\'s canonical name is Appetite-Fix Ability (Book 3). This key is retained strictly as a backward-compatibility alias.',
    relatedTerms: ['appetite_fix_ability', 'super_diet_ability'],
    status: 'deprecated',
    sourceRef: 'app_data:coaching.ts:people_social (legacy)',
    sourceType: 'developer-normalization',
    authorityLevel: 'developer-normalization',
    canonicalAliasFor: 'appetite_fix_ability',
  },

  delay_ability: {
    key: 'delay_ability',
    displayName: 'Delay Ability [Deprecated Non-Canonical]',
    shortDefinition: '[Deprecated non-canonical concept] Not one of Sergio\'s Seven Diet-Abilities. Mapped to The 15-Minute Resume Method.',
    fullExplanation: 'Deprecated in Phase 38. The manuscript audit confirmed that Delay Ability is not one of Sergio Laurant\'s Seven Diet-Abilities. Its intended behavioral technique is The 15-Minute Resume Method (Book 1 Ch 11) or Metabolic Pauses (Book 4 Ch 13). Retained as an alias to avoid breaking legacy references.',
    relatedTerms: ['fifteen_minute_resume_method', 'urge_timer', 'resume_ability'],
    status: 'deprecated',
    sourceRef: 'app_data:coaching.ts:delay (legacy)',
    sourceType: 'developer-normalization',
    authorityLevel: 'developer-normalization',
    canonicalAliasFor: 'fifteen_minute_resume_method',
  },

  structured_diet: {
    key: 'structured_diet',
    displayName: 'Structured Diet',
    shortDefinition: 'A chosen, intentional framework defining when, what, and how you plan to eat.',
    fullExplanation: 'A Structured Diet is not imposed from outside; it is chosen by the user. Having explicit structure makes on-track moments clear and returns after slips immediately visible.',
    relatedTerms: ['structure', 'on_track', 'structured_slip'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_sd',
  },

  structure: {
    key: 'structure',
    displayName: 'Structure',
    shortDefinition: 'The observable rules, schedule, and food boundaries currently active for the day.',
    relatedTerms: ['structured_diet', 'planned', 'on_track'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_sd',
  },

  on_track: {
    key: 'on_track',
    displayName: 'On Track',
    shortDefinition: 'Eating fully aligned with your intended structure and planned meal parameters.',
    relatedTerms: ['adjusted_on_track', 'structure', 'structured_diet'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:on_track',
  },

  adjusted_on_track: {
    key: 'adjusted_on_track',
    displayName: 'Adjusted and On Track',
    shortDefinition: 'A deliberate, conscious change in timing, portions, or food that still respects your dietary intent.',
    fullExplanation: 'Life presents changes. Adapting with awareness is not slipping—it is flexible mastery aligned with your structure.',
    relatedTerms: ['on_track', 'structure'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:adjusted_on_track',
  },

  near_slip: {
    key: 'near_slip',
    displayName: 'Near-Slip',
    shortDefinition: 'An intense urge or boundary approach where you successfully paused and stopped before crossing into a slip.',
    fullExplanation: 'Near-Slip is a moment of high awareness. Because the boundary was not crossed, it is not a slip and does not count as a resume event.',
    relatedTerms: ['structured_slip', 'slippery_zones', 'urge_timer'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:near_slip',
  },

  structured_slip: {
    key: 'structured_slip',
    displayName: 'Structured Slip',
    shortDefinition: 'An app operational record for a slip occurring on an active structured day.',
    fullExplanation: 'App operational outcome layer: records when a slip occurs within a day where an active Structured Diet baseline is defined. Followed immediately by the opportunity to Resume.',
    relatedTerms: ['unstructured_slip', 'resume', 'slippery_zones'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_slip',
    sourceType: 'app-operational',
    authorityLevel: 'operational-schema',
  },

  unstructured_slip: {
    key: 'unstructured_slip',
    displayName: 'Unstructured Slip',
    shortDefinition: 'An app operational record for a slip occurring on an unstructured day.',
    fullExplanation: 'App operational outcome layer: records when a slip occurs on a day without active meal boundaries or schedule. Still fully capable of being resumed as soon as conscious awareness returns.',
    relatedTerms: ['structured_slip', 'resume'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:unstructured_slip',
    sourceType: 'app-operational',
    authorityLevel: 'operational-schema',
  },

  // ── The Five Manuscript Slip Types (Sergio Laurant, Book 1 Chapter 5) ──────
  timing_slip: {
    key: 'timing_slip',
    displayName: 'Timing Slip',
    shortDefinition: 'A slip where eating windows quietly expand, meals start too early, or finish too late.',
    fullExplanation: 'From Sergio Laurant (Book 1 Ch 5): Timing slips feel innocent because they often do not involve dramatic overeating, but they quietly remove the uninterrupted boundaries that metabolic systems need to rest.',
    relatedTerms: ['structured_slip', 'circadian_eating_ability', 'resume'],
    status: 'defined',
    sourceRef: 'SDA_Book_01_Resume-Ability.docx:Chapter_05',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  impulse_slip: {
    key: 'impulse_slip',
    displayName: 'Impulse Eating Slip',
    shortDefinition: 'A slip where eating happens automatically and almost unconsciously without a deliberate decision.',
    fullExplanation: 'From Sergio Laurant (Book 1 Ch 5): Impulse eating slips completely bypass conscious intention. Recognizing them requires slowing down the transition moments (e.g. arriving home after work).',
    relatedTerms: ['structured_slip', 'fifteen_minute_resume_method', 'slippery_zones'],
    status: 'defined',
    sourceRef: 'SDA_Book_01_Resume-Ability.docx:Chapter_05',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  hunger_misinterpretation_slip: {
    key: 'hunger_misinterpretation_slip',
    displayName: 'Hunger Misinterpretation Slip',
    shortDefinition: 'A slip where appetite, emotional cravings, or fatigue are mistaken for genuine biological hunger.',
    fullExplanation: 'From Sergio Laurant (Book 1 Ch 5): The body actually needed rest, hydration, a change of scenery, or a 10-minute pause, but appetite sent the person to food instead.',
    relatedTerms: ['structured_slip', 'appetite_fix_ability', 'fifteen_minute_resume_method'],
    status: 'defined',
    sourceRef: 'SDA_Book_01_Resume-Ability.docx:Chapter_05',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  portion_slip: {
    key: 'portion_slip',
    displayName: 'Portion Slip',
    shortDefinition: 'A slip where a meal begins structurally but continues past satiety because food is delicious or stopping feels incomplete.',
    fullExplanation: 'From Sergio Laurant (Book 1 Ch 5): The meal started On Track, but stopping was delayed. The remedy is establishing definitive meal closures and boundary awareness.',
    relatedTerms: ['structured_slip', 'keto_switching_ability', 'appetite_fix_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_01_Resume-Ability.docx:Chapter_05',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  structure_slip: {
    key: 'structure_slip',
    displayName: 'Structure Slip',
    shortDefinition: 'A quiet, gradual softening of the entire day\'s architecture through grazing and snacking.',
    fullExplanation: 'From Sergio Laurant (Book 1 Ch 5): The most common and quietest slip. No single dramatic binge, but continuous small caloric drinks, grazing, and unclear boundaries that soften the Structured Diet baseline.',
    relatedTerms: ['structured_slip', 'loss_maintenance_ability', 'resume_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_01_Resume-Ability.docx:Chapter_05',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  planned_unstructured: {
    key: 'planned_unstructured',
    displayName: 'Planned Unstructured',
    shortDefinition: 'An intentional, scheduled period with relaxed rules (e.g. social gathering or holiday meal).',
    fullExplanation: 'Planned flexibility is not a slip. Because it was scheduled in advance, it preserves your psychological alignment and commitment.',
    relatedTerms: ['twenty_percent_off_track', 'structure', 'planned'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:planned_unstructured',
    sourceType: 'app-operational',
    authorityLevel: 'operational-schema',
  },

  twenty_percent_off_track: {
    key: 'twenty_percent_off_track',
    displayName: '20% OFF TRACK',
    shortDefinition: 'An intentional flexibility buffer (e.g. 80/20 balance) that counts as an On-Track outcome, not a slip.',
    fullExplanation:
      '20% OFF TRACK is an intentional flexibility buffer derived from Sergio Laurant\'s 80/20 consistency principle (Book 1 Ch 13 and Book 2 Ch 4). It is a valid On-Track outcome, strictly not a slip. It represents conscious real-life flexibility (celebrations, restaurants, social events, imperfect timing). It is NEVER a carbohydrate percentage or an instruction to eat 20% healthy carbs.',
    relatedTerms: ['on_track', 'planned_unstructured'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:twenty_percent_off_track; SDA_Book_01:Chapter_13; SDA_Book_02:Chapter_04',
    sourceType: 'sergio-direct-instruction',
    authorityLevel: 'product-directive',
  },

  resume: {
    key: 'resume',
    displayName: 'Resume',
    shortDefinition: 'The conscious act of returning to your intended structure after slipping.',
    fullExplanation: 'Resume is an independent dimension of measurement. A user can have a Structured Slip + Resumed. It coexists with the slip and does not erase it.',
    relatedTerms: ['resume_ability', 'structured_slip', 'unstructured_slip'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:resumed',
  },

  commitment: {
    key: 'commitment',
    displayName: 'Commitment',
    shortDefinition: 'The explicit, stated pledge the user made regarding their daily structure and goals.',
    fullExplanation: 'A foundational anchor in SDA. The coach always references actual user commitment data and never invents promises.',
    relatedTerms: ['why', 'non_negotiables'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts',
  },

  why: {
    key: 'why',
    displayName: 'Why',
    shortDefinition: 'The core personal reasons, values, and motivations saved by the user for pursuing Super Diet-Ability.',
    fullExplanation: 'The internal grounding anchor. Referenced when motivation is needed; if no Why is saved, the coach suggests clarifying one rather than fabricating generic reasons.',
    relatedTerms: ['commitment', 'non_negotiables'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts',
  },

  non_negotiables: {
    key: 'non_negotiables',
    displayName: 'Non-Negotiables',
    shortDefinition: 'Personal, firm boundaries established by the user to protect their daily structure.',
    fullExplanation: 'Non-Negotiables are user-defined shields against common drift. The coach respects them as explicit user choices.',
    relatedTerms: ['commitment', 'slippery_zones'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_nn',
  },

  slippery_zones: {
    key: 'slippery_zones',
    displayName: 'Slippery Zones',
    shortDefinition: 'High-risk emotional, social, or environmental triggers where maintaining structure is especially challenging.',
    fullExplanation: 'Slippery zones are contextual risk factors (e.g. stress, fatigue, late nights, social events). The coach explores them without claiming they caused slips.',
    relatedTerms: ['near_slip', 'structured_slip'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_sz',
  },

  daily_check_in: {
    key: 'daily_check_in',
    displayName: 'Daily Check-In',
    shortDefinition: 'An intentional daily touchpoint to verify status, record awareness, and log diet outcomes.',
    relatedTerms: ['daily_review', 'on_track'],
    status: 'defined',
    sourceRef: 'app_engine:checkInStorage.ts',
  },

  daily_review: {
    key: 'daily_review',
    displayName: 'Daily Review',
    shortDefinition: 'An end-of-day reflective summary that builds awareness of wins, slips, and resume behaviors.',
    relatedTerms: ['daily_check_in', 'score'],
    status: 'defined',
    sourceRef: 'app_engine:checkInStorage.ts',
  },

  neutral_log: {
    key: 'neutral_log',
    displayName: 'Neutral Log',
    shortDefinition: 'A flexible, non-evaluative registration record for items or activities the user wants to log without food scoring or forcing food categorization.',
    fullExplanation: 'A dedicated non-evaluative registration record carrying zero point awards and zero dietary scoring, providing a judgment-free space to record items without dietary evaluation.',
    relatedTerms: ['food_log'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:Phase31C',
    sourceType: 'sergio-direct-instruction',
    authorityLevel: 'product-directive',
  },

  food_log: {
    key: 'food_log',
    displayName: 'Food Log',
    shortDefinition: 'Recording meals, snacks, or drinks with portions, categories, and timestamps.',
    relatedTerms: ['neutral_log', 'structure'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts',
  },

  planned: {
    key: 'planned',
    displayName: 'Planned',
    shortDefinition: 'Meals or events scheduled in advance.',
    fullExplanation: 'Planning is a scheduling attribute. It differs from structured alignment: an unplanned meal can still be completely structured.',
    relatedTerms: ['unplanned', 'structure', 'planned_unstructured'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts',
  },

  unplanned: {
    key: 'unplanned',
    displayName: 'Unplanned',
    shortDefinition: 'Spontaneous food choices or events not scheduled in advance.',
    fullExplanation: 'Unplanned does NOT equal unstructured. A spontaneous meal can respect all nutritional boundaries.',
    relatedTerms: ['planned', 'structure'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts',
  },

  micro_fasting: {
    key: 'micro_fasting',
    displayName: 'Micro-Fasting',
    shortDefinition: 'Brief, structured pauses between meals to build appetite awareness and mental discipline.',
    fullExplanation: 'Referenced in Phase 9 terminology. Full procedural protocols are partially codified in current app source.',
    relatedTerms: ['structured_diet', 'delay_ability'],
    status: 'partial',
    sourceRef: 'app_terminology:sda_term_mf',
  },

  urge_timer: {
    key: 'urge_timer',
    displayName: 'Urge Timer',
    shortDefinition: 'A 15-minute dedicated timer providing a conscious pause between an urge and an action.',
    fullExplanation: 'Based on Delay Ability: urges peak and subside like waves. Holding the pause for 15 minutes allows intentional choice to return.',
    relatedTerms: ['delay_ability', 'near_slip'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts:delay',
  },

  score: {
    key: 'score',
    displayName: 'Today\'s Score',
    shortDefinition: 'The daily score earned through positive actions, check-ins, honest reporting, and resume behavior.',
    relatedTerms: ['lifetime_score', 'progression_level'],
    status: 'defined',
    sourceRef: 'app_engine:scoringEngine.ts',
  },

  lifetime_score: {
    key: 'lifetime_score',
    displayName: 'Lifetime XP',
    shortDefinition: 'Cumulative experience points earned across all days. Never decreases upon slips.',
    relatedTerms: ['score', 'progression_level'],
    status: 'defined',
    sourceRef: 'app_engine:progressionEngine.ts',
  },

  progression_level: {
    key: 'progression_level',
    displayName: 'Progression Level',
    shortDefinition: 'The user\'s current tier in the SDA progression system based on cumulative lifetime XP.',
    relatedTerms: ['lifetime_score', 'score'],
    status: 'defined',
    sourceRef: 'app_engine:progressionEngine.ts',
  },

  loss_maintenance_ability: {
    key: 'loss_maintenance_ability',
    displayName: 'Loss-Maintenance Ability',
    shortDefinition: 'The central umbrella ability to protect fat loss progress over the long term by maintaining eating structure.',
    relatedTerms: ['super_diet_ability', 'resume_ability', 'structured_diet'],
    status: 'defined',
    sourceRef: 'SDA_Book_02:Chapters_01_02',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  appetite_fix_ability: {
    key: 'appetite_fix_ability',
    displayName: 'Appetite-Fix Ability',
    shortDefinition: 'The capacity to retrain hunger signals, differentiate biological hunger from cravings, and reset the appetite thermostat.',
    fullExplanation: 'Authoritative Book 3 ability in Super Diet-Ability. Focuses on fixing meal satiety (the Satiety Toolbox: protein, fiber, water volume, chew density) so the spaces between meals can be protected without willpower battles.',
    relatedTerms: ['super_diet_ability', 'appetite_ability', 'satiety_toolbox'],
    status: 'defined',
    sourceRef: 'SDA_Book_03_Appetite-Fix-Ability.docx:Chapter_01',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  insulin_aware_ability: {
    key: 'insulin_aware_ability',
    displayName: 'Insulin-Aware Ability',
    shortDefinition: 'Understanding insulin as a vital metabolic messenger, building balanced whole-food plates, and allowing metabolic pauses.',
    relatedTerms: ['super_diet_ability', 'structured_diet'],
    status: 'defined',
    sourceRef: 'SDA_Book_04:Chapter_02',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  keto_switching_ability: {
    key: 'keto_switching_ability',
    displayName: 'Keto-Switching Ability',
    shortDefinition: 'The capability to transition smoothly from burning incoming food energy to mobilizing stored body energy.',
    relatedTerms: ['super_diet_ability', 'insulin_aware_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_05:Chapter_02',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  circadian_eating_ability: {
    key: 'circadian_eating_ability',
    displayName: 'Circadian Eating Ability',
    shortDefinition: 'Aligning food intake with the body’s 24-hour clock across Eating Phase, Clearing Phase, and Overnight Gap.',
    relatedTerms: ['super_diet_ability', 'micro_fasting_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_06:Chapter_02',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  micro_fasting_ability: {
    key: 'micro_fasting_ability',
    displayName: 'Micro-Fasting Ability',
    shortDefinition: 'The capstone ability: building, protecting, and extending spaces between meals one manageable 15-minute block at a time.',
    relatedTerms: ['super_diet_ability', 'circadian_eating_ability', 'resume_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_07:Chapter_01',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
  },

  restarting_vs_resuming: {
    key: 'restarting_vs_resuming',
    displayName: 'Restarting vs Resuming',
    shortDefinition: 'Restarting implies erasing history; resuming picks up your structure immediately on the very next choice.',
    relatedTerms: ['resume_ability', 'resume'],
    status: 'defined',
    sourceRef: 'SDA_Book_01:Chapter_02',
  },

  fifteen_minute_resume_method: {
    key: 'fifteen_minute_resume_method',
    displayName: '15-Minute Resume Method',
    shortDefinition: 'Starting a 15-minute timer during an urge or after a slip to let dopamine waves crest and settle before choosing.',
    relatedTerms: ['resume_ability', 'urge_timer'],
    status: 'defined',
    sourceRef: 'SDA_Book_01:Chapter_11',
  },

  craving_block: {
    key: 'craving_block',
    displayName: 'The Craving Block',
    shortDefinition: 'A 15-minute micro-fasting block dedicated to allowing conscious choice to return during an urge.',
    relatedTerms: ['micro_fasting_ability', 'fifteen_minute_resume_method'],
    status: 'defined',
    sourceRef: 'SDA_Book_07:Chapter_15',
  },

  stop_rules: {
    key: 'stop_rules',
    displayName: 'Stop Rules',
    shortDefinition: 'Pre-decided non-negotiable conditions under which fasting terminates immediately for medical safety.',
    relatedTerms: ['micro_fasting_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_07:Chapter_29',
  },

  incoming_vs_stored_energy: {
    key: 'incoming_vs_stored_energy',
    displayName: 'Incoming vs Stored Energy',
    shortDefinition: 'The natural cycle between utilizing recently digested calories versus mobilizing stored body fat and glycogen.',
    relatedTerms: ['keto_switching_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_05:Chapter_02',
  },

  metabolic_flexibility: {
    key: 'metabolic_flexibility',
    displayName: 'Metabolic Flexibility',
    shortDefinition: 'The capacity of the metabolism to switch smoothly between carbohydrate and fat oxidation without crashes.',
    relatedTerms: ['keto_switching_ability', 'insulin_aware_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_05:Chapter_04',
  },

  appetite_thermostat: {
    key: 'appetite_thermostat',
    displayName: 'Appetite Thermostat',
    shortDefinition: 'The adaptive biological hunger regulatory system that can be retrained with whole foods and nutrient density.',
    relatedTerms: ['appetite_fix_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_03:Chapter_03',
  },

  satiety_toolbox: {
    key: 'satiety_toolbox',
    displayName: 'The Satiety Toolbox',
    shortDefinition: 'Four biological satiety levers: protein leverage, viscous fiber, food volume/water, and chewing density.',
    relatedTerms: ['appetite_fix_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_03:Chapter_09',
  },

  fat_loss_duet: {
    key: 'fat_loss_duet',
    displayName: 'The Fat-Loss Duet',
    shortDefinition: 'Alternating between active moderate deficit phases and structured maintenance consolidation phases.',
    relatedTerms: ['loss_maintenance_ability'],
    status: 'defined',
    sourceRef: 'SDA_Book_02:Chapter_09',
  },
};

