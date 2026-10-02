/**
 * SDA AI Coach — Coaching Planner & Methodology Engine (Phase 35)
 *
 * Provider-independent orchestration pipeline:
 * RAW MESSAGE → UNDERSTANDING → CONTEXT → SDA KNOWLEDGE → COACHING PLAN → RESPONSE
 *
 * Enforces:
 * - Clear separation of Context Facts vs Coach Observations
 * - Prohibited Assumptions guardrails
 * - Non-shaming, recovery-oriented communication
 * - Causation prohibition on Slippery Zones
 * - Zero automatic data mutation & zero unearned score
 * - Knowledge gap fallback for undefined doctrines
 */

import type { CoachContext, CoachUnderstanding } from '../types';
import type {
  SDACoachingPlan,
  SDAKnowledgeBase,
  SDAPrincipleId,
  SDATermKey,
} from './types';

export interface BuildCoachingPlanOptions {
  message: string;
  understanding: CoachUnderstanding;
  context: CoachContext;
  knowledgeBase: SDAKnowledgeBase;
  language?: 'en' | 'es' | 'nl';
}

/**
 * Builds a structured, provider-independent SDACoachingPlan.
 */
export function buildCoachingPlan(options: BuildCoachingPlanOptions): SDACoachingPlan {
  const { message, understanding, context, knowledgeBase, language = 'en' } = options;
  const rawLower = message.toLowerCase();

  // 1. Check for Knowledge Gaps (Undefined doctrines, unsupported abilities)
  const knowledgeGap = knowledgeBase.checkKnowledgeGap(message);
  if (knowledgeGap) {
    return {
      mode: 'INFORMATION',
      primaryGoal: 'Acknowledge knowledge boundary without fabricating doctrine',
      relevantPrinciples: ['confirmation_first_data_safety'],
      relevantTerms: ['super_diet_ability', 'sda'],
      contextFacts: [`Active ability is ${context.ability}`],
      coachObservations: [`User asked about unsupported or reserved topic: "${knowledgeGap.requestedTopic}"`],
      questions: [],
      shouldAskQuestion: false,
      shouldOfferAction: false,
      prohibitedAssumptions: [
        'Do not fabricate doctrines, abilities, or rules not present in app source.',
        'Do not guess uncodified Seven Diet-Abilities.',
      ],
      knowledgeGap,
    };
  }

  // 2. Terminology inquiry check (e.g. "What is 20% off track?", "Explain resume ability")
  const isExplainingConcept = rawLower.includes('what is') || rawLower.includes('qué es') || rawLower.includes('wat is') ||
    rawLower.includes('explain') || rawLower.includes('explica') || rawLower.includes('leg uit') ||
    rawLower.includes('meaning of') || rawLower.includes('significado');

  if (isExplainingConcept) {
    const allTerms = knowledgeBase.getAllTerms();
    const matchedTerm = allTerms.find(t => 
      rawLower.includes(t.displayName.toLowerCase()) || 
      rawLower.includes(t.key.replace(/_/g, ' '))
    );

    if (matchedTerm) {
      return {
        mode: 'INFORMATION',
        primaryGoal: `Explain the SDA concept of ${matchedTerm.displayName}`,
        relevantPrinciples: ['awareness_over_perfection', 'structure_is_observable'],
        relevantTerms: [matchedTerm.key],
        contextFacts: [`Concept ${matchedTerm.displayName} has status: ${matchedTerm.status}`],
        coachObservations: [`User asked for definition of ${matchedTerm.displayName}`],
        questions: [],
        shouldAskQuestion: false,
        shouldOfferAction: false,
        prohibitedAssumptions: [
          'Do not invent details beyond the authoritative definition.',
          'Do not translate internal canonical IDs.',
        ],
      };
    }
  }

  // 3. Action Preparation (Logging food, neutral records, etc. with complete proposals)
  if (
    !understanding.requiresClarification &&
    understanding.proposedAction &&
    ['LOG_FOOD', 'LOG_NEUTRAL'].includes(understanding.proposedAction.type)
  ) {
    const isNeutral = understanding.proposedAction.type === 'LOG_NEUTRAL';
    const relevantPrinciples: SDAPrincipleId[] = isNeutral
      ? ['neutral_log_is_non_evaluative', 'confirmation_first_data_safety']
      : ['structure_is_observable', 'confirmation_first_data_safety'];
    const relevantTerms: SDATermKey[] = isNeutral
      ? ['neutral_log']
      : ['food_log', 'structure'];

    const facts: string[] = [
      `Proposed action: ${understanding.proposedAction.type}`,
      `Confirmation required: ${understanding.proposedAction.requiresConfirmation}`,
    ];

    const observations: string[] = [
      `User provided clear logging entry: "${message}"`,
      `Human readable summary: ${understanding.proposedAction.humanReadableSummary}`,
    ];

    return {
      mode: 'ACTION_PREPARATION',
      primaryGoal: isNeutral
        ? 'Prepare neutral log proposal concisely without dosage or nutrition advice'
        : 'Prepare food log proposal concisely without lecturing or calorie estimates',
      relevantPrinciples,
      relevantTerms,
      contextFacts: facts,
      coachObservations: observations,
      questions: [],
      shouldAskQuestion: false,
      shouldOfferAction: true,
      actionProposal: understanding.proposedAction,
      prohibitedAssumptions: [
        'Do not evaluate neutral items as food or nutrition.',
        'Do not provide medical or dosage recommendations.',
        'Do not lecture the user on food choices when they just want to log.',
        'Do not assume or state that data has been saved before user confirmation.',
      ],
    };
  }

  // 4. Near-Slip Coaching
  const isNearSlip = understanding.entities.outcome === 'near_slip' ||
    rawLower.includes('almost slipped') || rawLower.includes('casi me salgo') || rawLower.includes('bijna uitgegleden') ||
    rawLower.includes('almost ate') || rawLower.includes('casi como') || rawLower.includes('bijna gegeten') ||
    rawLower.includes('near slip') || rawLower.includes('near-slip') ||
    (rawLower.includes('urge') && rawLower.includes('stopped')) ||
    (rawLower.includes('impulso') && rawLower.includes('frené'));

  if (isNearSlip) {
    const facts: string[] = [
      'Near-Slip outcome identified: boundary was approached but not crossed.',
      `User has ${context.slipperyZones.zones.length} saved Slippery Zones.`,
    ];
    const observations: string[] = [
      'User exhibited conscious restraint before crossing their dietary boundary.',
    ];
    const matchingZone = context.slipperyZones.zones.find(z => rawLower.includes(z.toLowerCase()));
    if (matchingZone) {
      facts.push(`Mentioned factor "${matchingZone}" matches a saved Slippery Zone.`);
      observations.push(`Slippery Zone context detected: ${matchingZone}`);
    }

    const question = matchingZone
      ? (language === 'es'
          ? `"${matchingZone}" es una de tus Zonas Resbaladizas guardadas. ¿Formó parte de este momento?`
          : (language === 'nl'
              ? `"${matchingZone}" is een van je opgeslagen Glijdende Zones. Speelde dit een rol?`
              : `"${matchingZone}" is one of your identified Slippery Zones. Was it part of what made this moment slippery?`))
      : (language === 'es'
          ? '¿Qué condiciones hicieron que este momento fuera resbaladizo?'
          : (language === 'nl'
              ? 'Welke omstandigheden maakten dit moment uitdagend?'
              : 'What conditions made this moment feel slippery?'));

    return {
      mode: 'AWARENESS',
      primaryGoal: 'Acknowledge awareness and restraint without false resume classification',
      relevantPrinciples: ['near_slip_is_not_slip', 'awareness_over_perfection', 'slippery_zones_are_triggers_not_causes'],
      relevantTerms: ['near_slip', 'slippery_zones', 'urge_timer'],
      contextFacts: facts,
      coachObservations: observations,
      questions: [question],
      shouldAskQuestion: true,
      suggestedQuestion: question,
      shouldOfferAction: false,
      prohibitedAssumptions: [
        'Do not describe Near-Slip as a completed slip.',
        'Do not automatically increment or record a Resume event for a Near-Slip.',
        'Do not state that the slippery zone caused the urge as a proven fact.',
      ],
    };
  }

  // 5. Slip & Recovery Coaching
  const isSlipIntent = understanding.intent === 'LOG_SLIP' ||
    (understanding.intent !== 'REVIEW_SLIPPERY_ZONES' && (
      (/\bslips?\b|\bslipped\b|\bslipping\b/i.test(rawLower) && !rawLower.includes('slippery') && !rawLower.includes('resbaladiza') && !rawLower.includes('glijdende')) ||
      (/\bdesliz\b|\bdeslices\b|\bdeslicé\b/i.test(rawLower) && !rawLower.includes('resbaladiza')) ||
      (/\buitglijder\b|\buitgegleden\b/i.test(rawLower) && !rawLower.includes('glijdende')) ||
      rawLower.includes('cheated') || rawLower.includes('me salí') || rawLower.includes('afgeweken')
    ));

  if (isSlipIntent) {
    const hasClarification = understanding.requiresClarification && understanding.ambiguities.length > 0;
    const subtype = understanding.entities.outcome;
    const hasResumed = understanding.entities.resumed === true;
    const resumeMins = understanding.entities.resumeDurationMinutes;

    const facts: string[] = [
      `Slip intent detected. Subtype: ${subtype || 'unspecified'}.`,
      `Resumed status: ${hasResumed ? 'true' : 'false'}.`,
      resumeMins ? `Recovery duration parsed: ${resumeMins} minutes.` : 'No recovery duration specified.',
      `Today slips count: ${context.today.slipsCount}, today resumes count: ${context.today.resumedCount}.`,
    ];

    const observations: string[] = [];
    if (!subtype) {
      observations.push('User did not specify whether the slip was Structured or Unstructured.');
    }
    if (hasResumed) {
      observations.push('User explicitly reported returning to structure after the slip.');
    }

    // Check for Slippery Zone mention without claiming causation
    const matchingZone = context.slipperyZones.zones.find(z => rawLower.includes(z.toLowerCase()));
    if (matchingZone) {
      facts.push(`Mentioned term "${matchingZone}" matches a saved Slippery Zone.`);
      observations.push(`Possible contextual trigger noted: ${matchingZone}`);
    }

    let suggestedQ: string | undefined;
    if (hasClarification && understanding.ambiguities[0]?.field === 'outcome') {
      suggestedQ = language === 'es'
        ? '¿Ocurrió durante tu estructura habitual (Desliz Estructurado) o fue en un día sin plan (No Estructurado)?'
        : (language === 'nl'
            ? 'Gebeurde dit binnen je normale structuur (Gestructureerde Uitglijder) of zonder plan (Ongestructureerd)?'
            : 'Did this happen within your regular structure (Structured Slip) or when you had no plan active (Unstructured Slip)?');
    } else if (!hasResumed) {
      suggestedQ = language === 'es'
        ? '¿Has retomado ya tu estructura alimentaria, o estás preparándote para el siguiente bloque?'
        : (language === 'nl'
            ? 'Heb je je structuur inmiddels hervat, of bereid je je voor op het volgende eetmoment?'
            : 'Have you resumed your structure yet, or are you preparing for your next scheduled meal?');
    }

    return {
      mode: 'RECOVERY',
      primaryGoal: hasResumed
        ? 'Validate both slip and resume behavior, honoring recovery speed'
        : 'Acknowledge slip honestly, identify subtype, and orient toward resuming structure',
      relevantPrinciples: [
        'slip_is_information_not_ruin',
        'resume_is_independent_behavior',
        'resume_speed_is_true_power',
        'positive_reporting_no_punishment',
        'slippery_zones_are_triggers_not_causes',
      ],
      relevantTerms: ['structured_slip', 'unstructured_slip', 'resume', 'resume_ability', 'slippery_zones'],
      contextFacts: facts,
      coachObservations: observations,
      questions: suggestedQ ? [suggestedQ] : [],
      shouldAskQuestion: Boolean(suggestedQ),
      suggestedQuestion: suggestedQ,
      shouldOfferAction: Boolean(understanding.proposedAction),
      actionProposal: understanding.proposedAction,
      prohibitedAssumptions: [
        'Do not assume a slip subtype if not specified by the user.',
        'Do not tell the user they ruined their diet or should wait until tomorrow.',
        'Do not automatically mark Resumed unless explicitly reported by the user.',
        'Do not erase or downplay the slip record when resume is reported.',
        'Do not claim a Slippery Zone caused the slip as an objective truth.',
      ],
    };
  }

  // 6. Commitment & Why Coaching
  if (understanding.intent === 'REVIEW_COMMITMENT') {
    const hasCommitment = context.commitment.hasCommitment;
    const reasons = context.commitment.reasons;
    const nonNeg = context.commitment.nonNegotiables;

    const facts: string[] = [
      `Has active commitment: ${hasCommitment}`,
      `Reasons count: ${reasons.length}`,
      `Non-Negotiables count: ${nonNeg.length}`,
    ];
    if (reasons.length > 0) facts.push(`Reasons: ${reasons.join(' | ')}`);
    if (nonNeg.length > 0) facts.push(`Non-Negotiables: ${nonNeg.join(' | ')}`);

    return {
      mode: 'COMMITMENT',
      primaryGoal: 'Surface actual saved commitment details without fabricating values',
      relevantPrinciples: ['commitment_and_why_anchors', 'non_negotiables_are_personal_shields'],
      relevantTerms: ['commitment', 'why', 'non_negotiables'],
      contextFacts: facts,
      coachObservations: [
        hasCommitment
          ? 'User has verified saved commitment data in app storage.'
          : 'User has no saved commitment records in app storage.',
      ],
      questions: [],
      shouldAskQuestion: false,
      shouldOfferAction: false,
      prohibitedAssumptions: [
        'Do not fabricate commitment reasons or non-negotiables if none are saved.',
        'Do not preach generic diet rules as user commitments.',
      ],
    };
  }

  if (understanding.intent === 'REVIEW_WHY') {
    const reasons = context.commitment.reasons;
    const facts: string[] = [
      `Saved Why count: ${reasons.length}`,
    ];
    if (reasons.length > 0) facts.push(`Reasons: ${reasons.join(' | ')}`);

    return {
      mode: 'MOTIVATION',
      primaryGoal: 'Ground user in their authentic personal Why reasons',
      relevantPrinciples: ['commitment_and_why_anchors'],
      relevantTerms: ['why', 'commitment'],
      contextFacts: facts,
      coachObservations: [
        reasons.length > 0
          ? 'Authentic reasons exist in CoachContext.'
          : 'No reasons currently saved by user.',
      ],
      questions: [],
      shouldAskQuestion: false,
      shouldOfferAction: false,
      prohibitedAssumptions: [
        'Do not invent motivational statements and attribute them to the user.',
      ],
    };
  }

  if (understanding.intent === 'REVIEW_NON_NEGOTIABLES') {
    const nonNeg = context.commitment.nonNegotiables;
    const facts: string[] = [
      `Saved Non-Negotiables count: ${nonNeg.length}`,
    ];
    if (nonNeg.length > 0) facts.push(`Non-Negotiables: ${nonNeg.join(' | ')}`);

    return {
      mode: 'COMMITMENT',
      primaryGoal: 'Remind user of their personal protective shields',
      relevantPrinciples: ['non_negotiables_are_personal_shields'],
      relevantTerms: ['non_negotiables', 'commitment'],
      contextFacts: facts,
      coachObservations: [
        nonNeg.length > 0
          ? 'Active Non-Negotiables present in CoachContext.'
          : 'User has not configured Non-Negotiables.',
      ],
      questions: [],
      shouldAskQuestion: false,
      shouldOfferAction: false,
      prohibitedAssumptions: [
        'Do not invent new Non-Negotiables without explicit user creation.',
      ],
    };
  }

  if (understanding.intent === 'REVIEW_SLIPPERY_ZONES') {
    const zones = context.slipperyZones.zones;
    const facts: string[] = [
      `Saved Slippery Zones count: ${zones.length}`,
    ];
    if (zones.length > 0) facts.push(`Zones: ${zones.join(' | ')}`);

    return {
      mode: 'AWARENESS',
      primaryGoal: 'Review saved high-risk trigger contexts',
      relevantPrinciples: ['slippery_zones_are_triggers_not_causes', 'awareness_over_perfection'],
      relevantTerms: ['slippery_zones'],
      contextFacts: facts,
      coachObservations: [
        zones.length > 0
          ? 'Slippery Zones present in user profile.'
          : 'User has not yet identified personal Slippery Zones.',
      ],
      questions: [],
      shouldAskQuestion: false,
      shouldOfferAction: false,
      prohibitedAssumptions: [
        'Do not describe Slippery Zones as deterministic causes.',
      ],
    };
  }

  // 7. Motivation Coaching
  if (understanding.intent === 'NEED_MOTIVATION') {
    const reasons = context.commitment.reasons;
    return {
      mode: 'MOTIVATION',
      primaryGoal: 'Provide grounded, SDA-consistent encouragement anchored in user Why',
      relevantPrinciples: ['resume_speed_is_true_power', 'awareness_over_perfection', 'commitment_and_why_anchors'],
      relevantTerms: ['why', 'resume_ability', 'commitment'],
      contextFacts: [
        `Top personal reason: ${reasons[0] || 'none'}`,
        `Current level: ${context.progression.level} (${context.progression.levelTitle})`,
      ],
      coachObservations: [
        reasons[0]
          ? `Anchor to user's authentic reason: "${reasons[0]}"`
          : 'No personal reasons saved; using core SDA resilience principles.',
      ],
      questions: [],
      shouldAskQuestion: false,
      shouldOfferAction: false,
      prohibitedAssumptions: [
        'Do not invent dietary claims or medical outcomes.',
        'Do not use generic superficial clichés.',
      ],
    };
  }

  // 8. Daily Status / Daily Review Reflection
  if (understanding.intent === 'CHECK_TODAY_STATUS' || understanding.intent === 'REVIEW_DAY') {
    const { today, progression, structuredDiet } = context;
    return {
      mode: 'REFLECTION',
      primaryGoal: 'Provide objective, awareness-building snapshot of today without moral grading',
      relevantPrinciples: ['positive_reporting_no_punishment', 'structure_is_observable'],
      relevantTerms: ['score', 'daily_review', 'structure', 'food_log', 'daily_check_in'],
      contextFacts: [
        `Score: ${today.todayScore} pts`,
        `Level: Level ${progression.level}: ${progression.levelTitle}`,
        `Food logs: ${today.foodLogsCount} (${today.totalPortions} portions)`,
        `Check-ins: ${today.checkInCount}`,
        `Slips: ${today.slipsCount}, Resumes: ${today.resumedCount}`,
        `Structured Diet plan active: ${structuredDiet.hasPlan}`,
      ],
      coachObservations: [
        today.foodLogsCount === 0 && today.checkInCount === 0
          ? 'No logs or check-ins recorded yet today.'
          : 'Activity recorded for today.',
      ],
      questions: [],
      shouldAskQuestion: false,
      shouldOfferAction: false,
      prohibitedAssumptions: [
        'Do not label the day as good or bad.',
        'Do not invent missing records.',
        'Do not overwhelm with every raw statistic.',
      ],
    };
  }

  // 9. Default General Coaching
  return {
    mode: 'SUPPORT',
    primaryGoal: 'Offer supportive, awareness-oriented guidance centered on structure and resume capability',
    relevantPrinciples: ['awareness_over_perfection', 'structure_is_observable', 'resume_speed_is_true_power'],
    relevantTerms: ['super_diet_ability', 'structure', 'resume_ability'],
    contextFacts: [`Active ability: ${context.ability}`],
    coachObservations: ['General guidance request.'],
    questions: [],
    shouldAskQuestion: false,
    shouldOfferAction: false,
    prohibitedAssumptions: [
      'Do not assume user wants generic nutritional advice.',
      'Do not prescribe calories or meal plans.',
    ],
  };
}

/**
 * Deterministically renders a human-readable coach response from an SDACoachingPlan.
 * Adheres strictly to the SDA communication guidelines (non-shaming, calm, concise, grounded).
 */
export function generateCoachingResponse(plan: SDACoachingPlan, language: 'en' | 'es' | 'nl' = 'en'): string {
  // 1. Knowledge Gap Handling
  if (plan.knowledgeGap) {
    if (language === 'es') {
      if (plan.knowledgeGap.status === 'reserved') {
        return `Actualmente estoy enfocado en Super Diet-Ability (SDA). ${plan.knowledgeGap.requestedTopic} es un módulo reservado para el futuro y aún no está disponible en la app.`;
      }
      return `Aún no dispongo de suficiente material oficial de SDA para "${plan.knowledgeGap.requestedTopic}". Solo respondo con base en principios verificados de Super Diet-Ability.`;
    }
    if (language === 'nl') {
      if (plan.knowledgeGap.status === 'reserved') {
        return `Ik ben momenteel gericht op Super Diet-Ability (SDA). ${plan.knowledgeGap.requestedTopic} is gereserveerd voor een toekomstige release en is nog niet beschikbaar.`;
      }
      return `Ik heb nog niet voldoende officieel SDA-bronnenmateriaal voor "${plan.knowledgeGap.requestedTopic}". Ik coach uitsluitend op basis van vastgelegde Super Diet-Ability concepten.`;
    }
    return plan.knowledgeGap.fallbackMessage;
  }

  // 2. Action Preparation (Logging Food, Neutral Record, or Check-In)
  if (plan.mode === 'ACTION_PREPARATION' && plan.actionProposal) {
    const summary = plan.actionProposal.humanReadableSummary;
    const isNeutral = plan.actionProposal.type === 'LOG_NEUTRAL';
    const isCheckIn = plan.actionProposal.type === 'LOG_CHECK_IN';

    if (isCheckIn) {
      if (language === 'es') {
        return `Excelente autoconciencia. He preparado tu Check-In diario:\n\n• ${summary}`;
      }
      if (language === 'nl') {
        return `Goede zelfreflectie. Ik heb je dagelijkse check-in voorbereid:\n\n• ${summary}`;
      }
      return `Great awareness. Here is your daily check-in proposal:\n\n• ${summary}`;
    }

    if (isNeutral) {
      if (language === 'es') {
        return `He preparado este registro neutral (las vitaminas y suplementos no afectan tus estadísticas ni puntuación de comida):\n\n• ${summary}\n\nPor favor confirma antes de guardar.`;
      }
      if (language === 'nl') {
        return `Ik heb deze neutrale registratie voorbereid (supplementen hebben geen invloed op je maaltijdstatistieken of structuurscore):\n\n• ${summary}\n\nBevestig voor het opslaan.`;
      }
      return `I've prepared this neutral log proposal (vitamins/supplements do not count as food or affect your structure score):\n\n• ${summary}\n\nPlease confirm or edit before continuing.`;
    }

    if (language === 'es') {
      return `He preparado esta propuesta de registro de comida:\n\n• ${summary}\n\nPor favor confirma o edita antes de continuar.`;
    }
    if (language === 'nl') {
      return `Ik heb dit voorstel voor je maaltijdregistratie voorbereid:\n\n• ${summary}\n\nBevestig of bewerk voor het opslaan.`;
    }
    return `I've prepared this food log proposal for you:\n\n• ${summary}\n\nPlease confirm or edit before continuing.`;
  }

  // 3. Near-Slip Awareness
  if (plan.mode === 'AWARENESS' && plan.relevantTerms.includes('near_slip')) {
    const questionText = plan.suggestedQuestion ? `\n\n${plan.suggestedQuestion}` : '';
    if (language === 'es') {
      return `Estuviste a punto de cruzar tu límite pero te detuviste antes de salirte de tu estructura. Esa capacidad de pausa requiere una gran autoconciencia.${questionText}`;
    }
    if (language === 'nl') {
      return `Je naderde je grens maar wist op tijd te stoppen. Die pauze tussen impuls en actie getuigt van sterke zelfreflectie.${questionText}`;
    }
    return `You came close to crossing your boundary but paused and stopped before slipping. That pause between urge and action is powerful awareness.${questionText}`;
  }

  // 4. Slippery Zones Review
  if (plan.mode === 'AWARENESS' && plan.relevantTerms.includes('slippery_zones') && !plan.relevantTerms.includes('near_slip') && !plan.relevantTerms.includes('structured_slip')) {
    const zonesFact = plan.contextFacts.find(f => f.startsWith('Zones:'));
    if (zonesFact) {
      const rawZones = zonesFact.replace('Zones:', '').split('|').map(s => s.trim()).filter(Boolean);
      const list = rawZones.map((z, i) => `${i + 1}. ⚠️ ${z}`).join('\n');
      if (language === 'es') {
        return `Tus Zonas Resbaladizas personales:\n${list}\n\nIdentificarlas con antelación es el 80% de la victoria.`;
      }
      if (language === 'nl') {
        return `Jouw persoonlijke Glijdende Zones:\n${list}\n\nHerkenning vooraf is 80% van de overwinning.`;
      }
      return `Your Personal Slippery Zones:\n${list}\n\nRecognizing these environments or triggers beforehand is 80% of the victory.`;
    }

    if (language === 'es') {
      return 'Aún no has registrado Zonas Resbaladizas personales. Añade tus situaciones de riesgo en la sección correspondiente.';
    }
    if (language === 'nl') {
      return 'Je hebt nog geen persoonlijke Glijdende Zones ingesteld. Voeg je risicosituaties toe in het menu.';
    }
    return "You haven't defined any personal Slippery Zones yet. Identifying your high-risk triggers gives you advance warning.";
  }

  // 5. Recovery & Slip Coaching
  if (plan.mode === 'RECOVERY') {
    const facts = plan.contextFacts;
    const hasResumed = facts.some(f => f.includes('Resumed status: true'));
    const subtypeFact = facts.find(f => f.includes('Subtype:'));
    const isStructured = subtypeFact?.includes('structured_slip');
    const isUnstructured = subtypeFact?.includes('unstructured_slip');

    // Subcase 5A: Slip + Explicit Resume
    if (hasResumed) {
      const typeLabel = isStructured
        ? (language === 'es' ? 'Desliz Estructurado' : language === 'nl' ? 'Gestructureerde Uitglijder' : 'Structured Slip')
        : (isUnstructured
            ? (language === 'es' ? 'Desliz No Estructurado' : language === 'nl' ? 'Ongestructureerde Uitglijder' : 'Unstructured Slip')
            : (language === 'es' ? 'desliz' : language === 'nl' ? 'uitglijder' : 'slip'));

      const minsMatch = plan.contextFacts.find(f => f.includes('Recovery duration parsed:'));
      const durationStr = minsMatch ? minsMatch.replace('Recovery duration parsed:', '').trim() : '';

      if (language === 'es') {
        const timeNote = durationStr ? ` en ${durationStr}` : '';
        return `Registraste un ${typeLabel} y retomaste tu estructura${timeNote}. Ambos datos son valiosos: el desvío queda registrado con honestidad, y tu capacidad de retomar demuestra la verdadera fuerza de la Resume-Ability.`;
      }
      if (language === 'nl') {
        const timeNote = durationStr ? ` na ${durationStr}` : '';
        return `Je hebt een ${typeLabel} genoteerd en je structuur${timeNote} hervat. Beide gegevens zijn waardevol: de afwijking is eerlijk vastgelegd en je hervatting toont de ware kracht van Resume-Ability.`;
      }
      const timeNote = durationStr ? ` after ${durationStr}` : '';
      return `You recorded a ${typeLabel} and resumed your structure${timeNote}. Both pieces of data matter: the departure is acknowledged honestly, and your recovery reinforces your Resume-Ability.`;
    }

    // Subcase 5B: Specific Slip without Resume yet
    if (isStructured || isUnstructured) {
      const typeLabel = isStructured
        ? (language === 'es' ? 'Desliz Estructurado' : language === 'nl' ? 'Gestructureerde Uitglijder' : 'Structured Slip')
        : (language === 'es' ? 'Desliz No Estructurado' : language === 'nl' ? 'Ongestructureerde Uitglijder' : 'Unstructured Slip');

      const question = plan.suggestedQuestion || (
        language === 'es'
          ? '¿Has retomado ya tu estructura, o estás listo para planificar el siguiente bloque?'
          : (language === 'nl'
              ? 'Heb je je structuur inmiddels hervat, of ben je klaar voor het volgende eetmoment?'
              : 'Have you resumed your structure yet, or are you ready to focus on the next scheduled meal?')
      );

      if (language === 'es') {
        return `Has registrado un ${typeLabel}. Un desliz es solo información sobre dónde la estructura se encontró con un impulso, nunca el fin del día. ${question}`;
      }
      if (language === 'nl') {
        return `Je hebt een ${typeLabel} geregistreerd. Een uitglijder is slechts informatie over waar structuur en drang botsten, nooit het einde van de dag. ${question}`;
      }
      return `You recorded a ${typeLabel}. A slip is simply data on where your structure met an urge, never the end of the day. ${question}`;
    }

    // Subcase 5C: General Slip needing clarification
    const question = plan.suggestedQuestion || (
      language === 'es'
        ? '¿Cómo clasificarías lo sucedido?'
        : (language === 'nl'
            ? 'Hoe zou je omschrijven wat er gebeurde?'
            : 'How would you describe what happened?')
    );

    if (language === 'es') {
      return `Respira hondo. Un desliz es solo información, no un fracaso; no arruina tu progreso a menos que abandones. ¿Deseas registrar este desliz? ${question}`;
    }
    if (language === 'nl') {
      return `Haal diep adem. Een uitglijder is waardevolle data, geen nederlaag. Wil je deze uitglijder vastleggen? ${question}`;
    }
    return `Take a breath. A slip is valuable behavioral data, not ruin or failure. Would you like to record this slip? ${question}`;
  }

  // 6. Motivation & Why
  if (plan.mode === 'MOTIVATION') {
    const reasonsFact = plan.contextFacts.find(f => f.startsWith('Reasons:'));
    if (reasonsFact) {
      const reasons = reasonsFact.replace('Reasons:', '').split('|').map(s => s.trim()).filter(Boolean);
      const list = reasons.map((r, i) => `${i + 1}. "${r}"`).join('\n');
      if (language === 'es') {
        return `Tus razones personales ("Tu Porqué"):\n${list}\n\nRecuerda esto cuando sientas tentación o cansancio.`;
      }
      if (language === 'nl') {
        return `Jouw persoonlijke redenen ("Mijn Waarom"):\n${list}\n\nHoud dit voor ogen wanneer je verleiding of vermoeidheid voelt.`;
      }
      return `Here are your personal reasons ("My Why"):\n${list}\n\nKeep these front and center whenever urges or fatigue arise.`;
    }

    const whyCountFact = plan.contextFacts.find(f => f.startsWith('Saved Why count: 0'));
    if (whyCountFact) {
      if (language === 'es') {
        return 'Aún no has registrado tus razones personales. Dirígete a "Mis Compromisos" para escribir tu "Porqué".';
      }
      if (language === 'nl') {
        return 'Je hebt je persoonlijke redenen nog niet vastgelegd. Ga naar "Mijn Verplichtingen" om jouw "Waarom" in te vullen.';
      }
      return "You haven't set a personal 'Why' yet. Head over to 'My Commitments' to write down the core reasons driving your journey.";
    }

    const topReasonFact = plan.contextFacts.find(f => f.startsWith('Top personal reason:'));
    const savedWhy = topReasonFact && !topReasonFact.includes('none')
      ? topReasonFact.replace('Top personal reason:', '').trim()
      : null;

    if (savedWhy) {
      if (language === 'es') {
        return `Recuerda tu mayor motivación: "${savedWhy}". No necesitas un día perfecto, solo tomar la siguiente decisión estructurada. ¡Estás a un paso de retomar el control!`;
      }
      if (language === 'nl') {
        return `Denk aan je belangrijkste reden: "${savedWhy}". Je hebt geen perfecte dag nodig, alleen de volgende juiste beslissing. Je bent altijd één keuze verwijderd van herstel!`;
      }
      return `Remember your driving purpose: "${savedWhy}". You do not need a flawless day—you only need to make the next decision a structured one. Resume right now!`;
    }

    if (language === 'es') {
      return 'Cada desliz es simplemente información, no un fracaso. En el método SDA, tu verdadera fuerza es la velocidad con la que retomas la estructura. ¡El siguiente bloque es tuyo!';
    }
    if (language === 'nl') {
      return 'Elke uitglijder is slechts een leermoment, geen nederlaag. Binnen SDA is jouw kracht de snelheid van hervatting. Pak de volgende maaltijd weer op!';
    }
    return 'Every slip is merely data, never a failure. In the SDA system, your true power is the speed of your Resume. You are always one decision away from being back on structure.';
  }

  // 7. Commitment & Non-Negotiables
  if (plan.mode === 'COMMITMENT') {
    const hasCommitmentFact = plan.contextFacts.some(f => f.includes('Has active commitment: true'));
    const nonNegFact = plan.contextFacts.find(f => f.startsWith('Non-Negotiables:'));
    const reasonsFact = plan.contextFacts.find(f => f.startsWith('Reasons:'));

    // Subcase 7A: Explicit Non-Negotiables review
    if (plan.relevantTerms.includes('non_negotiables') && !plan.relevantTerms.includes('why')) {
      if (nonNegFact) {
        const rules = nonNegFact.replace('Non-Negotiables:', '').split('|').map(s => s.trim()).filter(Boolean);
        const list = rules.map((n, i) => `${i + 1}. 🛡️ ${n}`).join('\n');
        if (language === 'es') {
          return `Tus No Negociables activos:\n${list}\n\nEstas son tus líneas de defensa para evitar deslices.`;
        }
        if (language === 'nl') {
          return `Jouw actieve niet-onderhandelbare regels:\n${list}\n\nDit zijn jouw grenzen die voorkomen dat je afdwaalt.`;
        }
        return `Your active Non-Negotiables:\n${list}\n\nThese boundaries protect you from unthinking drift.`;
      }

      if (language === 'es') {
        return 'Aún no has definido reglas No Negociables. Establécelas en "Mis Compromisos" para proteger tus límites.';
      }
      if (language === 'nl') {
        return 'Je hebt nog geen niet-onderhandelbare regels ingesteld. Stel ze in bij "Mijn Verplichtingen" om je grenzen te bewaken.';
      }
      return "You haven't set any Non-Negotiables yet. Setting 2 or 3 firm rules in 'My Commitments' builds an instant shield.";
    }

    // Subcase 7B: Full Commitment review
    if (!hasCommitmentFact) {
      if (language === 'es') {
        return 'Aún no has establecido un compromiso. Ve a "Mis Compromisos" para registrar tu Porqué y tus No Negociables.';
      }
      if (language === 'nl') {
        return 'Je hebt nog geen commitment vastgelegd. Ga naar "Mijn Verplichtingen" om je Waarom en regels in te stellen.';
      }
      return "You haven't set a commitment yet. Head over to 'My Commitments' to record your personal Why and Non-Negotiables.";
    }

    const reasonsList = reasonsFact
      ? `\n🎯 Reasons:\n${reasonsFact.replace('Reasons:', '').split('|').map(s => `• ${s.trim()}`).join('\n')}`
      : '';
    const nonNegList = nonNegFact
      ? `\n🛡️ Non-Negotiables:\n${nonNegFact.replace('Non-Negotiables:', '').split('|').map(s => `• ${s.trim()}`).join('\n')}`
      : '';

    return `Your Current Commitment:${reasonsList}${nonNegList}`;
  }

  // 8. Reflection / Daily Status
  if (plan.mode === 'REFLECTION') {
    const isQuiet = plan.coachObservations.some(o => o.includes('No logs or check-ins recorded yet'));
    const scoreFact = plan.contextFacts.find(f => f.startsWith('Score:'))?.replace('Score:', '').trim() || '0 pts';
    const levelFact = plan.contextFacts.find(f => f.startsWith('Level:'))?.replace('Level:', '').trim() || '';

    if (isQuiet) {
      if (language === 'es') {
        return `Aún no has registrado alimentos ni check-ins hoy. Tu puntaje actual es ${scoreFact} (${levelFact}). ¿Cómo va tu día?`;
      }
      if (language === 'nl') {
        return `Je hebt vandaag nog geen maaltijden of check-ins geregistreerd. Je score is ${scoreFact} (${levelFact}). Hoe verloopt je dag?`;
      }
      return `You haven't logged any food or check-ins yet today. Your current score is ${scoreFact} (${levelFact}). How is your day starting out?`;
    }

    const foodFact = plan.contextFacts.find(f => f.startsWith('Food logs:'))?.replace('Food logs:', '').trim() || '0';
    const checkInFact = plan.contextFacts.find(f => f.startsWith('Check-ins:'))?.replace('Check-ins:', '').trim() || '0';
    const slipsFact = plan.contextFacts.find(f => f.startsWith('Slips:')) || '';

    if (language === 'es') {
      return `Resumen de hoy:\n• Puntos: ${scoreFact} (${levelFact})\n• Comidas registradas: ${foodFact}\n• Check-ins: ${checkInFact}\n• ${slipsFact}`;
    }
    if (language === 'nl') {
      return `Overzicht van vandaag:\n• Score: ${scoreFact} (${levelFact})\n• Maaltijden: ${foodFact}\n• Check-ins: ${checkInFact}\n• ${slipsFact}`;
    }
    return `Today's Status:\n• Score: ${scoreFact} (${levelFact})\n• Food Logs: ${foodFact}\n• Check-Ins: ${checkInFact}\n• ${slipsFact}`;
  }

  // 9. Information (Term Definition)
  if (plan.mode === 'INFORMATION' && plan.relevantTerms.length > 0) {
    const termKey = plan.relevantTerms[0];
    if (termKey === 'twenty_percent_off_track') {
      if (language === 'es') {
        return '20% OFF TRACK es un margen de flexibilidad intencional en el estilo de vida (basado en el principio 80/20 de Sergio Laurant). Cuenta como un resultado En Estructura (+5 puntos), no es un desliz y no representa una cuota ni porcentaje de carbohidratos.';
      }
      if (language === 'nl') {
        return '20% OFF TRACK is een bewuste flexibiliteitsbuffer voor je levensstijl (zoals de 80/20-balans van Sergio Laurant). Het telt als een On Track-uitkomst (+5 punten), is geen uitglijder en heeft geen betrekking op koolhydraatpercentages of macro-doelen.';
      }
      return "20% OFF TRACK is an intentional lifestyle flexibility buffer within Sergio Laurant's 80/20 consistency principle. It is an On-Track outcome (+5 pts), not a slip, and has zero connection to carbohydrate percentages or macronutrient quotas.";
    }
    if (termKey === 'resume_ability') {
      if (language === 'es') {
        return 'Resume-Ability es la capacidad de hacer una pausa entre la sensación y la acción, y volver a tu estructura en cualquier momento tras un desliz.';
      }
      if (language === 'nl') {
        return 'Resume-Ability is het vermogen om te pauzeren tussen gevoel en handeling, en op elk gewenst moment terug te keren naar je structuur na een uitglijder.';
      }
      return 'Resume-Ability is the capacity to pause between feeling and action, and return to your structure at any point after a slip.';
    }
  }

  // Default fallback
  if (language === 'es') {
    return 'Estoy aquí para apoyarte con tu estructura alimentaria, tus zonas resbaladizas y tu próxima decisión. ¿En qué podemos enfocarnos ahora?';
  }
  if (language === 'nl') {
    return 'Ik ben er om je te ondersteunen met je eetstructuur, valkuilen en je volgende stap. Waar wil je nu aan werken?';
  }
  return "I'm here to support you with your eating structure, slippery zones, and next moves. What are you facing right now?";
}
