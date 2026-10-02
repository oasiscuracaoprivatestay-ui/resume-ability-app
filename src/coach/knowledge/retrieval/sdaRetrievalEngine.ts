/**
 * SDA Authoritative Retrieval Engine (Phase 36B)
 *
 * Deterministic, multi-dimensional retrieval system that matches user queries
 * and conversational contexts against the Authoritative SDA Knowledge Corpus.
 *
 * Capabilities:
 * - Ability-specific filtering (Books 1 to 7)
 * - Cross-ability multi-dimensional matching (e.g. fasting + slip -> Micro-Fasting + Resume-Ability)
 * - Safety boundary priority detection (stop rules, red flag symptoms, contraindications)
 * - Application feature discovery (current vs planned features)
 * - KnowledgeGap detection for ungrounded or external fad diet queries
 * - Bounded payload sizing for safe AI prompt injection
 *
 * Zero external database or vector store dependencies; fully upgradable to vector/embeddings.
 */

import type {
  CanonicalDietAbilityId,
  RetrievalQuery,
  RetrievalResult,
  SDAKnowledgeUnit,
  AppKnowledgeUnit,
  SafetyProtocol,
} from '../types';
import {
  ALL_SDA_KNOWLEDGE_UNITS,
  APP_KNOWLEDGE_UNITS,
  SDA_SAFETY_PROTOCOLS,
} from '../corpus';
import { CANONICAL_SEVEN_DIET_ABILITIES } from '../abilities/sevenDietAbilities';

/**
 * Known unsupported topics that must trigger a KnowledgeGap rather than generic advice.
 */
const UNSUPPORTED_EXTERNAL_TOPICS = [
  { trigger: 'cabbage soup', reason: 'Fad mono-diet outside SDA methodology' },
  { trigger: 'blood type diet', reason: 'External pseudoscientific diet outside SDA methodology' },
  { trigger: 'carnivore diet', reason: 'Zero-plant extreme elimination outside SDA whole foods foundation' },
  { trigger: 'hcg diet', reason: 'Hormone-based extreme restriction prohibited in SDA' },
  { trigger: 'juice cleanse', reason: 'Liquid calorie detox fad contradicted by SDA whole foods and insulin principles' },
  { trigger: 'cleanse juice', reason: 'Liquid calorie detox fad contradicted by SDA whole foods and insulin principles' },
  { trigger: 'tapeworm', reason: 'Dangerous medical condition / unsafe practice' },
  { trigger: 'diet pills', reason: 'Pharmaceutical stimulants outside behavioral coaching' },
  { trigger: 'rapid 10 kg in 3 days', reason: 'Extreme crash starvation contradicted by Loss-Maintenance Ability' },
];

/**
 * Multi-dimensional retrieval function.
 */
export function retrieveSDAKnowledge(query: RetrievalQuery): RetrievalResult {
  const limit = query.limit ?? 5;
  const rawLower = (query.rawText ?? '').toLowerCase().trim();

  // 1. Check for Knowledge Gap first
  for (const item of UNSUPPORTED_EXTERNAL_TOPICS) {
    if (rawLower.includes(item.trigger)) {
      return {
        units: [],
        matchedAbilities: [],
        matchedTerms: [],
        safetyBoundaries: [],
        appFeatures: [],
        isKnowledgeGap: true,
        gapReason: `The topic "${item.trigger}" is not part of Sergio Laurant's Super Diet-Ability methodology (${item.reason}).`,
      };
    }
  }

  // 2. Identify Safety Boundaries
  const matchedSafety: SafetyProtocol[] = [];
  const safetyKeywords = [
    'dizzy',
    'dizziness',
    'mareo',
    'duizelig',
    'faint',
    'fainting',
    'desmayo',
    'flauwvallen',
    'chest pain',
    'dolor de pecho',
    'pijn op de borst',
    'palpitation',
    'palpitaciones',
    'hartkloppingen',
    'shaking',
    'temblor',
    'trillen',
    'vomiting',
    'vomito',
    'overgeven',
    'pregnant',
    'embarazada',
    'zwanger',
    'breastfeeding',
    'lactancia',
    'borstvoeding',
    'eating disorder',
    'trastorno alimentario',
    'eetstoornis',
    'anorexia',
    'bulimia',
    'insulin injection',
    'diabetes medication',
    'hypoglycemia',
  ];

  if (safetyKeywords.some((kw) => rawLower.includes(kw))) {
    if (
      rawLower.includes('pregnant') ||
      rawLower.includes('embarazada') ||
      rawLower.includes('zwanger') ||
      rawLower.includes('breastfeeding') ||
      rawLower.includes('eating disorder') ||
      rawLower.includes('eetstoornis')
    ) {
      matchedSafety.push(SDA_SAFETY_PROTOCOLS.fasting_contraindicated_populations);
    }
    if (
      rawLower.includes('dizzy') ||
      rawLower.includes('faint') ||
      rawLower.includes('chest pain') ||
      rawLower.includes('shaking') ||
      rawLower.includes('vomit')
    ) {
      matchedSafety.push(SDA_SAFETY_PROTOCOLS.emergency_symptoms_stop_rule);
    }
    if (
      rawLower.includes('medication') ||
      rawLower.includes('insulin') ||
      rawLower.includes('diabetes') ||
      rawLower.includes('hypoglycemia')
    ) {
      matchedSafety.push(SDA_SAFETY_PROTOCOLS.medication_and_diabetes_boundary);
    }
  }

  // 3. Identify Target Abilities
  const matchedAbilities = new Set<CanonicalDietAbilityId>();

  // Explicit ability request
  if (query.abilityId && CANONICAL_SEVEN_DIET_ABILITIES[query.abilityId]) {
    matchedAbilities.add(query.abilityId);
  }

  // Ability keyword triggers
  const abilityTriggers: Record<CanonicalDietAbilityId, string[]> = {
    resume_ability: ['resume', 'slip', 'slipped', 'resuming', 'restart', 'slippery', '15-minute', 'urge', 'fell off', 'ruined'],
    loss_maintenance_ability: ['maintenance', 'maintain', 'umbrella', '80/20', 'whole food', 'long term', 'deficit', 'weighing', 'plateau', 'structure'],
    appetite_fix_ability: ['appetite', 'hunger', 'craving', 'hungry', 'emotional eat', 'satiety', 'fullness', 'disruptor', 'thermostat'],
    insulin_aware_ability: ['insulin', 'blood sugar', 'glucose', 'carb', 'carbohydrate', 'liquid calorie', 'grazing', 'label', 'glycemic'],
    keto_switching_ability: ['keto', 'switching', 'stored energy', 'incoming energy', 'metabolic flexibility', 'fat adapted', 'clean gap', 'fat burn'],
    circadian_eating_ability: ['circadian', 'night', 'evening', 'late night', 'rhythm', 'clearing phase', 'overnight', 'timing', 'sleep', 'shift work'],
    micro_fasting_ability: ['fast', 'fasting', 'micro-fast', 'timer', 'block', 'ladder', '16 hour', 'stop rule', 'refeed', 'break fast'],
  };

  for (const [abilityId, triggers] of Object.entries(abilityTriggers)) {
    if (triggers.some((t) => rawLower.includes(t))) {
      matchedAbilities.add(abilityId as CanonicalDietAbilityId);
    }
  }

  // 4. Score and Rank Knowledge Units
  interface ScoredUnit {
    unit: SDAKnowledgeUnit;
    score: number;
  }

  const scoredUnits: ScoredUnit[] = [];

  for (const unit of ALL_SDA_KNOWLEDGE_UNITS) {
    let score = 0;

    // Safety priority boost
    if (matchedSafety.length > 0 && unit.safetyClassification === 'safety_boundary') {
      score += 100;
    }

    // Chapter title matching
    if (unit.chapterTitle && rawLower.includes(unit.chapterTitle.toLowerCase())) {
      score += 40;
    }

    // Direct ability match
    if (matchedAbilities.has(unit.abilityId as CanonicalDietAbilityId)) {
      score += 20;
    }

    // Related abilities match
    for (const rel of unit.relatedAbilities) {
      if (matchedAbilities.has(rel)) {
        score += 10;
      }
    }

    // Topic tags matching
    for (const tag of unit.topicTags) {
      if (rawLower.includes(tag.replace(/_/g, ' '))) {
        score += 25;
      }
    }

    // Concepts matching
    for (const concept of unit.concepts) {
      if (rawLower.includes(concept.toLowerCase())) {
        score += 20;
      }
    }

    // Terminology matching
    for (const term of unit.terminology) {
      if (rawLower.includes(term.toLowerCase())) {
        score += 20;
      }
    }

    // Content keyword overlap
    const words = rawLower.split(/\s+/).filter((w) => w.length > 4);
    for (const word of words) {
      if (unit.content.toLowerCase().includes(word)) {
        score += 5;
      }
    }

    // App feature link match
    if (query.appFeature && unit.relatedAppFeatures.includes(query.appFeature)) {
      score += 25;
    }

    if (score > 0) {
      scoredUnits.push({ unit, score });
    }
  }

  // Sort descending by relevance score
  scoredUnits.sort((a, b) => b.score - a.score);

  let selectedUnits = scoredUnits.slice(0, limit).map((s) => s.unit);

  // If no units scored, fallback to core Book 1 Ch 1
  if (selectedUnits.length === 0) {
    selectedUnits = ALL_SDA_KNOWLEDGE_UNITS.filter(
      (u) => u.bookNumber === 1 && (u.chapter === 1 || u.chapter === 2)
    );
  }

  // 5. Match App Features (Ordered from most specific to general)
  const matchedAppFeatures: AppKnowledgeUnit[] = [];
  const appScreenTriggers: Record<string, string[]> = {
    neutral_log: ['neutral log', 'neutral', 'non-evaluative', 'water', 'vitamins', 'supplements', 'register'],
    'slip-type': ['report a slip', 'report slip', 'reporting a slip', 'recommit', 're-commit', 'slip flow', 'honest slip'],
    'check-in': ['check-in', 'check in', 'morning check', 'evening check', 'presence ring'],
    'structured-diet': ['structured diet', 'plan diet', 'eating window', 'meal window', 'structure'],
    food_log: ['food log', 'on track', '20%', 'off track', 'record meal', 'meal outcome', 'log meal'],
    home: ['home', 'dashboard', 'streak', 'level', 'xp'],
    'daily-review': ['daily review', 'evening review', 'reflect', 'end of day'],
    timer: ['timer', '15 min timer', 'fasting timer', 'countdown', 'urge timer'],
  };

  for (const [screenKey, triggers] of Object.entries(appScreenTriggers)) {
    if (triggers.some((t) => rawLower.includes(t))) {
      const feat = APP_KNOWLEDGE_UNITS.find(
        (f) => f.screen === screenKey || f.screen?.startsWith(screenKey) || f.featureKey.includes(screenKey)
      );
      if (feat && !matchedAppFeatures.some((m) => m.id === feat.id)) {
        matchedAppFeatures.push(feat);
      }
    }
  }

  return {
    units: selectedUnits,
    matchedAbilities: Array.from(matchedAbilities),
    matchedTerms: [],
    safetyBoundaries: matchedSafety,
    appFeatures: matchedAppFeatures,
    isKnowledgeGap: false,
  };
}
