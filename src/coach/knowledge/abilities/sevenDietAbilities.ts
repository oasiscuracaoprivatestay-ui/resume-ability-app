/**
 * Canonical Seven Diet-Abilities Registry (Phase 36B / Phase 38)
 *
 * Source: The Seven Authoritative Sergio Laurant Super Diet-Ability Manuscripts.
 * Domain: 'diet' within the broader Super Ability architecture.
 *
 * Authority Model (Phase 38):
 * - All Seven Abilities are grounded in Authoritative Sergio Laurant Manuscripts (Category A).
 * - Only Resume-Ability currently has an active, operational in-app challenge.
 * - Remaining six abilities are conceptual guidance and doctrine-only until specifically implemented.
 */

import type { CanonicalAbilityDefinition, CanonicalDietAbilityId } from '../types';

export const CANONICAL_SEVEN_DIET_ABILITIES: Record<CanonicalDietAbilityId, CanonicalAbilityDefinition> = {
  resume_ability: {
    id: 'resume_ability',
    bookNumber: 1,
    officialTitle: 'Resume-Ability',
    subtitle: 'The Skill That Keeps You Consistent on Any Diet',
    author: 'Sergio Laurant',
    domain: 'diet',
    coreDefinition:
      'The behavioral capacity to pause between an urge and an action, to recover immediately after a slip without restarting, and to shorten the distance between slipping and returning to your structured plan.',
    centralParadigmShift:
      'Consistency is not about never making a mistake; consistency is built on the speed and certainty of your return. You are never actually off your diet—you are either on your structured diet or on your default unstructured diet.',
    keyTechniques: [
      'The 15-Minute Resume Method',
      'The Five Types of Slips categorization',
      'Slippery Zone terrain mapping',
      'The Seven Signals recognition',
      'The Core Flow (Feel, Pause, Choose, Resume)',
    ],
    keyNonNegotiables: [
      'Never wait until tomorrow or Monday to resume',
      'A slip is behavioral data, never a moral failure',
      'Enter slippery zones with awareness rather than avoidance',
      'Report slips honestly without point loss or shame',
    ],
    relationshipsWithOtherAbilities: {
      loss_maintenance_ability: 'Resume-Ability provides the recovery mechanics that make lifetime maintenance possible.',
      appetite_fix_ability: 'Appetite awareness provides Signal Three that warns a slip is forming.',
      insulin_aware_ability: 'Insulin-aware pauses prevent metabolic triggers from turning into behavioral slips.',
      keto_switching_ability: 'Protecting meal gaps depends on the ability to pause and resume when tempted.',
      circadian_eating_ability: 'Circadian boundaries establish the temporal structure that Resume-Ability defends.',
      micro_fasting_ability: 'Micro-Fasting provides the progressive time containers used to bridge back after slips.',
    },
    sourceBookFile: 'SDA_Book_01_Resume-Ability.docx',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    appFeatureStatus: 'active_challenge',
    coachingAvailability: 'full_coaching',
    breakdownOrder: 7, // Final failure point
    recoveryOrder: 1,  // Rebuilt first: foundation of all recovery
  },

  loss_maintenance_ability: {
    id: 'loss_maintenance_ability',
    bookNumber: 2,
    officialTitle: 'Loss-Maintenance Ability',
    subtitle: 'The Umbrella Ability / Why Maintenance Comes Before Fat Loss',
    author: 'Sergio Laurant',
    domain: 'diet',
    coreDefinition:
      'The central umbrella ability to protect fat loss progress over the long term by maintaining a recognizable eating structure, managing deviations, recovering from slips, and adapting to life without requiring permanent extreme restriction.',
    centralParadigmShift:
      'Maintenance begins with the very first pound you lose, not at the end of the diet. If you cannot maintain a baseline structure right now, an aggressive fat-loss deficit will only create temporary loss followed by inevitable regain.',
    keyTechniques: [
      'The Fat-Loss Duet (Protect current baseline while creating the next deficit)',
      'Start in Maintenance Mode',
      'The 80/20 Principle (Structured consistency vs perfection)',
      'Whole Foods Foundation',
      'Non-Negotiables as Anchors (The Last Line of Defense)',
    ],
    keyNonNegotiables: [
      'Maintain an observable structure even during difficult life phases',
      'Never trade metabolic health for short-term scale drops',
      'Build habits that survive messy real-world conditions',
    ],
    relationshipsWithOtherAbilities: {
      resume_ability: 'Resume-Ability is the engine that prevents temporary maintenance disruptions from becoming total abandonments.',
      appetite_fix_ability: 'Appetite regulation keeps maintenance from feeling like an unending willpower battle.',
      insulin_aware_ability: 'Insulin sensitivity protects the metabolic foundation required for weight stability.',
      keto_switching_ability: 'Metabolic flexibility allows the body to maintain weight without constant incoming fuel.',
      circadian_eating_ability: 'Daily metabolic timing prevents late-night calorie creeping during maintenance.',
      micro_fasting_ability: 'Fasting intervals provide strategic maintenance tools when used with proper readiness.',
    },
    sourceBookFile: 'SDA_Book_02_Loss-Maintenance-Ability.docx',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    appFeatureStatus: 'locked_future_ability',
    coachingAvailability: 'conceptual_guidance',
    breakdownOrder: 6,
    recoveryOrder: 2,
  },

  appetite_fix_ability: {
    id: 'appetite_fix_ability',
    bookNumber: 3,
    officialTitle: 'Appetite-Fix Ability',
    subtitle: 'Retrain Your Hunger. Reclaim Your Freedom.',
    author: 'Sergio Laurant',
    domain: 'diet',
    coreDefinition:
      'The capacity to retrain hunger signals, distinguish true physical appetite from emotional urges, habits, or conditioned cravings, and reset the internal appetite thermostat through nutrient-dense meals.',
    centralParadigmShift:
      'Your appetite is not broken and hunger is not your enemy. Appetite dysregulation is an adaptive response to ultra-processed foods, blood sugar swings, and emotional coping. When meals do their job, hunger becomes an ally rather than an emergency.',
    keyTechniques: [
      'The Satiety Toolbox (Protein, fiber, water volume, chew density)',
      'Identifying the Seven Appetite Disruptors',
      'The Hunger Roller Coaster interruption',
      'Craving Prediction vs Command reframing',
      'Fix the Meal Before Fighting the Gap',
    ],
    keyNonNegotiables: [
      'Never fight hunger with pure willpower without fixing meal satiety first',
      'Distinguish emotional appetite from genuine biological need',
      'Treat cravings as temporary dopamine predictions, not commands',
    ],
    relationshipsWithOtherAbilities: {
      resume_ability: 'Understanding appetite signals allows catching urges at the near-slip stage before slips occur.',
      loss_maintenance_ability: 'Satiety is what makes long-term maintenance sustainable without chronic misery.',
      insulin_aware_ability: 'Stabilizing blood sugar and insulin directly flattens the hunger roller coaster.',
      keto_switching_ability: 'Appetite fixes allow comfortable adaptation to the space between meals.',
      circadian_eating_ability: 'Aligning meals with daylight enhances leptin/ghrelin sensitivity.',
      micro_fasting_ability: 'You cannot safely micro-fast until physical hunger is distinguishable from cravings.',
    },
    sourceBookFile: 'SDA_Book_03_Appetite-Fix-Ability.docx',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    appFeatureStatus: 'locked_future_ability',
    coachingAvailability: 'conceptual_guidance',
    breakdownOrder: 5,
    recoveryOrder: 3,
  },

  insulin_aware_ability: {
    id: 'insulin_aware_ability',
    bookNumber: 4,
    officialTitle: 'Insulin-Aware Ability',
    subtitle: 'Understand the Signal. Make Better Decisions.',
    author: 'Sergio Laurant',
    domain: 'diet',
    coreDefinition:
      'The skill of understanding insulin as a vital metabolic signaling hormone, recognizing how food choices, meal timing, and food combinations influence insulin dynamics, and creating metabolic pauses between meals.',
    centralParadigmShift:
      'Insulin is not an enemy to be feared or eliminated; it is a life-sustaining storage messenger. The goal is not zero insulin, but insulin sensitivity—allowing insulin to do its job efficiently and then return to baseline so the body can access stored fat.',
    keyTechniques: [
      'Building an Insulin-Aware Plate (Protein, fibrous vegetables, mindful carbohydrates)',
      'Label-Reading Ability (Looking past front-package health halos to real ingredients)',
      'Liquid Calorie Elimination',
      'Metabolic Pauses between meals (stopping constant grazing)',
      'Shopping with Insulin Awareness',
    ],
    keyNonNegotiables: [
      'Stop continuous grazing; allow digestive and hormonal rest between meals',
      'Prioritize intact whole food structure over ultra-processed replacements',
      'Never demonize carbohydrates categorically; evaluate quality, whole food context, and personal tolerance',
    ],
    relationshipsWithOtherAbilities: {
      resume_ability: 'Understanding the insulin crash prevents physiological slips caused by hypoglycemia.',
      loss_maintenance_ability: 'Insulin sensitivity is a cornerstone of long-term metabolic health and fat loss defense.',
      appetite_fix_ability: 'Preventing sharp insulin spikes directly resolves the ravenous hunger roller coaster.',
      keto_switching_ability: 'Lowering baseline insulin is the physiological prerequisite for opening the keto switch.',
      circadian_eating_ability: 'Insulin sensitivity is naturally higher earlier in the day and drops sharply as melatonin rises.',
      micro_fasting_ability: 'Metabolic pauses are the entry-level blocks that build toward micro-fasting.',
    },
    sourceBookFile: 'SDA_Book_04_Insulin-Aware-Ability.docx',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    appFeatureStatus: 'locked_future_ability',
    coachingAvailability: 'conceptual_guidance',
    breakdownOrder: 4,
    recoveryOrder: 4,
  },

  keto_switching_ability: {
    id: 'keto_switching_ability',
    bookNumber: 5,
    officialTitle: 'Keto-Switching Ability',
    subtitle: 'Train Your Body to Move From Incoming Energy to Stored Energy',
    author: 'Sergio Laurant',
    domain: 'diet',
    coreDefinition:
      'The physiological and behavioral capacity to transition smoothly between burning incoming food energy (glucose) and utilizing stored body energy (fat and ketones) without suffering brain fog, intense panic, or energy crashes.',
    centralParadigmShift:
      'Metabolic flexibility is an innate human capability, not an extreme cult. You do not need perpetual ketogenic deprivation or meter obsession; you need a metabolism that is trained to access its own stored fuel when incoming food stops.',
    keyTechniques: [
      'The Switching Ladder (Progressive adaptation from 3 meals to clean spaces)',
      'Meal Boundaries (Firm final bites where switching begins)',
      'Protein and Fiber Switching Support',
      'Movement as a Metabolic Switch (Using muscle glycogen to accelerate fuel switching)',
      'Home and Workplace Switching Audits',
    ],
    keyNonNegotiables: [
      'Close meals definitively—no lingering or post-meal snacking',
      'Focus on metabolic capability and flexibility rather than scale or ketone obsession',
      'Respect the food environment as stronger than willpower',
    ],
    relationshipsWithOtherAbilities: {
      resume_ability: 'When fuel switching works, urges between meals diminish, making Resume-Ability simpler.',
      loss_maintenance_ability: 'Switching allows effortless weight stability because stored fat remains biologically accessible.',
      appetite_fix_ability: 'Switching to stored energy eliminates urgent hypoglycemic panic.',
      insulin_aware_ability: 'Lower insulin levels permit hormone-sensitive lipase to release stored fat for the switch.',
      circadian_eating_ability: 'The overnight circadian fasting window is the natural daily keto-switching training ground.',
      micro_fasting_ability: 'Keto-switching capability is the biological engine that makes micro-fasting comfortable.',
    },
    sourceBookFile: 'SDA_Book_05_Keto-Switching-Ability.docx',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    appFeatureStatus: 'locked_future_ability',
    coachingAvailability: 'conceptual_guidance',
    breakdownOrder: 3,
    recoveryOrder: 5,
  },

  circadian_eating_ability: {
    id: 'circadian_eating_ability',
    bookNumber: 6,
    officialTitle: 'Circadian Eating Ability',
    subtitle: 'Align Your Eating With the Rhythm of Your Body',
    author: 'Sergio Laurant',
    domain: 'diet',
    coreDefinition:
      'The strategic alignment of food intake with the body’s endogenous 24-hour circadian clock, honoring the three metabolic phases (Eating Phase, Clearing Phase, Overnight Gap) and optimizing insulin sensitivity, digestion, and sleep.',
    centralParadigmShift:
      'When you eat is just as consequential as what and how much you eat. The human body is metabolically primed for activity and nutrition during daylight hours and for cellular repair, autophagy, and lipid clearance at night.',
    keyTechniques: [
      'The Three Phases of the Metabolic Day (Eating Phase, Clearing Phase, Overnight Gap)',
      'Protecting the 12-Hour Natural Overnight Gap',
      'Designing Your Personal Metabolic Clock',
      'The Minimum Circadian Structure (anchoring the day during chaos)',
      'Late-Night Eating remediation (addressing daytime under-eating)',
      'Shift work and travel circadian adaptations',
    ],
    keyNonNegotiables: [
      'Protect the boundary between the final meal and sleep (minimum 2–3 hours)',
      'Protect a baseline natural overnight gap of 12 hours before extending fasts',
      'When medical needs or medications require food, health safety strictly supersedes clock ideals',
    ],
    relationshipsWithOtherAbilities: {
      resume_ability: 'Evening hours represent the most common slippery zone; circadian closing prevents late slips.',
      loss_maintenance_ability: 'Circadian alignment improves sleep quality, which directly defends against metabolic weight regain.',
      appetite_fix_ability: 'Proper meal timing prevents late-night leptin resistance and midnight ravenousness.',
      insulin_aware_ability: 'Insulin sensitivity is peak in the morning/midday and drops sharply as melatonin rises.',
      keto_switching_ability: 'The overnight clearing phase initiates natural circadian fuel switching.',
      micro_fasting_ability: 'Micro-fasting is built directly upon the foundation of the circadian overnight gap.',
    },
    sourceBookFile: 'SDA_Book_06_Circadian-Eating-Ability.docx',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    appFeatureStatus: 'locked_future_ability',
    coachingAvailability: 'conceptual_guidance',
    breakdownOrder: 2,
    recoveryOrder: 6,
  },

  micro_fasting_ability: {
    id: 'micro_fasting_ability',
    bookNumber: 7,
    officialTitle: 'Micro-Fasting Ability',
    subtitle: 'Build Longer Fasts One Manageable Block at a Time',
    author: 'Sergio Laurant',
    domain: 'diet',
    coreDefinition:
      'The practice of building, protecting, and progressively extending intentional spaces between meals using manageable 15-minute blocks, backed by biological readiness, stop rules, and respectful refeeding.',
    centralParadigmShift:
      'Fasting is not starvation, endurance punishment, or moral righteousness. Fasting is the deliberate space between meals that allows the body to complete digestion, enter keto-switching, and rest. Small 15-minute blocks make fasting achievable, safe, and sustainable.',
    keyTechniques: [
      'The 15-Minute Block (Single manageable decision unit)',
      'The Craving Block (Creating time for conscious choice to return)',
      'The Micro-Fasting Ladder (Overnight 12h → 14h → 16h → 20h → 24h)',
      'Readiness Before Duration evaluation',
      'Stop Rules and Red Flag Symptoms protocol',
      'Thoughtful Refeeding (No post-fast binging)',
      'The Recommended Default Five Non-Negotiables',
    ],
    keyNonNegotiables: [
      'Readiness before duration: never force an extended fast without foundational abilities',
      'Protect muscle and nourishment before chasing longer timer numbers',
      'Respect stop rules: immediately terminate the fast if concerning symptoms appear',
      'An app can say no to a target; an app can never medically clear a user',
      'Never use fasting to compensate for or punish a dietary slip',
    ],
    relationshipsWithOtherAbilities: {
      resume_ability: 'If a fast is broken early, it is treated as a Resume-Ability moment with zero shame.',
      loss_maintenance_ability: 'Micro-fasting provides flexible maintenance structure when practiced prudently.',
      appetite_fix_ability: 'Requires learning the language of hunger so mild informational hunger is not feared as an emergency.',
      insulin_aware_ability: 'Fasting provides the deepest metabolic pause for insulin levels to normalize.',
      keto_switching_ability: 'Keto-switching provides the cellular fuel that makes fasting gaps comfortable.',
      circadian_eating_ability: 'Micro-fasts must be aligned with circadian rhythms rather than distorting them.',
    },
    sourceBookFile: 'SDA_Book_07_Micro-Fasting-Ability.docx',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    appFeatureStatus: 'locked_future_ability',
    coachingAvailability: 'conceptual_guidance',
    breakdownOrder: 1, // First to break
    recoveryOrder: 7,  // Final culmination of mastery
  },
};

/**
 * Authoritative Breakdown Sequence from Sergio Laurant (Book 1, Chapter 22):
 * When diet discipline erodes, abilities break down in this sequential order:
 * Micro-Fasting -> Circadian -> Keto-Switching -> Insulin-Aware -> Appetite-Fix -> Loss-Maintenance -> Resume-Ability
 */
export const MANUSCRIPT_BREAKDOWN_SEQUENCE: CanonicalDietAbilityId[] = [
  'micro_fasting_ability',
  'circadian_eating_ability',
  'keto_switching_ability',
  'insulin_aware_ability',
  'appetite_fix_ability',
  'loss_maintenance_ability',
  'resume_ability',
];

/**
 * Authoritative Recovery Sequence from Sergio Laurant (Book 1, Chapter 22):
 * When rebuilding after disruption, restore abilities in this sequential order:
 * Resume-Ability -> Loss-Maintenance -> Appetite-Fix -> Insulin-Aware -> Keto-Switching -> Circadian -> Micro-Fasting
 */
export const MANUSCRIPT_RECOVERY_SEQUENCE: CanonicalDietAbilityId[] = [
  'resume_ability',
  'loss_maintenance_ability',
  'appetite_fix_ability',
  'insulin_aware_ability',
  'keto_switching_ability',
  'circadian_eating_ability',
  'micro_fasting_ability',
];

/**
 * Super Ability Ecosystem mapping
 */
export const SUPER_ABILITY_ECOSYSTEM = {
  activeDomain: 'diet',
  domains: {
    diet: {
      name: 'Super Diet-Ability',
      abilities: Object.values(CANONICAL_SEVEN_DIET_ABILITIES).map((a) => a.id),
      status: 'active',
    },
    productivity: {
      name: 'Super Productivity-Ability',
      abilities: ['deep_work_ability', 'task_completion_ability'],
      status: 'reserved',
    },
    'time-management': {
      name: 'Super Time-Management-Ability',
      abilities: ['block_scheduling_ability', 'rhythm_ability'],
      status: 'reserved',
    },
    organizer: {
      name: 'Super Organizer-Ability',
      abilities: ['spatial_clarity_ability', 'system_maintenance_ability'],
      status: 'reserved',
    },
    money: {
      name: 'Super Money-Ability',
      abilities: ['cashflow_awareness_ability', 'value_spending_ability'],
      status: 'reserved',
    },
    entrepreneurship: {
      name: 'Super Entrepreneurship-Ability',
      abilities: ['offer_creation_ability', 'execution_speed_ability'],
      status: 'reserved',
    },
  },
};
