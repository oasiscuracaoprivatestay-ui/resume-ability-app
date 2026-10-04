/**
 * SDA AI Coach — Personal Progress Coaching Engine (Phase 40C)
 *
 * Implements deterministic personal-state question classification and
 * grounded response generation using verified CoachContext snapshots.
 *
 * Enforces:
 * - Read-only execution: ZERO app mutation, ZERO action proposals
 * - Metric separation: todayPoints (XP) vs dailyResumeAbilityIndex (0-100 recovery dial)
 * - Strict verification: never manufacturing praise, numbers, or recovery unsupported by snapshot
 * - Privacy protection: reasons and rules only exposed if present in safe context
 * - Multilingual support: English (en), Spanish (es), Dutch (nl)
 */

import type {
  CoachContext,
  PersonalStateQueryCategory,
} from './types';

/**
 * Deterministically classifies read-only personal state questions.
 * Returns null if the message is an action request or not a personal state query.
 */
export function classifyPersonalStateQuery(text: string): PersonalStateQueryCategory | null {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();

  // 1. Guard against explicit action requests
  const isExplicitAction =
    /\b(?:log|record|register|track|add|anota|anotar|registra|registrar|invoeren|opslaan)\b/i.test(lower);
  if (isExplicitAction) {
    // If it's an explicit action request, it must enter the action proposal pipeline, not query
    return null;
  }

  // Guard against food logging statements (e.g. "I ate 200g chicken")
  if (/\b(?:i ate|i had|eating|com[ií]|cen[eé]|almorc[eé]|gegeten|ik heb .* gegeten)\b/i.test(lower) && !lower.endsWith('?')) {
    return null;
  }

  // Guard against reporting new slips or returns to structure
  if (/\b(?:i slipped|had a slip|deslic[eé]|uitgegleden)\b/i.test(lower) && !lower.includes('did i') && !lower.includes('tuve') && !lower.includes('heb ik')) {
    return null;
  }
  if (/\b(?:unstructured slip|structured slip|desliz no estructurado|desliz estructurado|ongestructureerde uitglijder|gestructureerde uitglijder)\b/i.test(lower) && !lower.endsWith('?')) {
    return null;
  }
  if (/\b(?:i'm back on structure|im back on structure|estoy de vuelta en estructura|ik ben weer op schema)\b/i.test(lower) && !lower.endsWith('?')) {
    return null;
  }
  if (/\b(?:check(?:ing)?\s*(?:me\s*)?in\s+as\b)/i.test(lower)) {
    return null;
  }

  // 2. Classify read-only categories (ordered by specificity)

  // A. Why / Commitment Recall
  if (
    /\b(?:why did i commit|what(?:'s| is) my why|why am i doing this|show my why|review my why|my reasons|remind me why)\b/i.test(lower) ||
    /\b(?:por qu[eé] me compromet[ií]|cu[aá]l es mi porqu[eé]|por qu[eé] estoy haciendo esto|mis motivos|mis razones)\b/i.test(lower) ||
    /\b(?:waarom heb ik me gecommitteerd|wat is mijn waarom|waarom doe ik dit|mijn redenen)\b/i.test(lower)
  ) {
    return 'COMMITMENT_RECALL';
  }

  // B. Non-Negotiables Recall
  if (
    /\b(?:what are my non[- ]negotiables|show my non[- ]negotiables|review my non[- ]negotiables|list my non[- ]negotiables|what are my rules|show (?:my )?rules)\b/i.test(lower) ||
    /\b(?:cu[aá]les son mis no negociables|mostrar mis no negociables|mis reglas|ver mis no negociables|cu[aá]les son mis reglas)\b/i.test(lower) ||
    /\b(?:wat zijn mijn niet[- ]onderhandelbare|toon mijn niet[- ]onderhandelbare|toon (?:mijn )?regels|wat zijn mijn regels)\b/i.test(lower)
  ) {
    return 'NON_NEGOTIABLE_RECALL';
  }

  // C. Daily Resume-Ability Index / Score
  // Must be checked before generic scoring to avoid conflating with today points
  if (
    /\b(?:daily resume[- ]ability|resume[- ]ability (?:score|index|level|dial)|how is my resume[- ]ability|what(?:'s| is) my (?:daily )?resume[- ]ability|how strong is my resume[- ]ability)\b/i.test(lower) ||
    /\b(?:cu[aá]l es mi (?:[ií]ndice|puntuaci[oó]n) de resume[- ]ability|c[oó]mo est[aá] mi resume[- ]ability)\b/i.test(lower) ||
    /\b(?:wat is mijn (?:dagelijkse )?resume[- ]ability|hoe is mijn resume[- ]ability)\b/i.test(lower)
  ) {
    return 'RESUME_ABILITY_STATUS';
  }

  // D. Scoring Status (Points, Lifetime XP, Level)
  if (
    /\b(?:how many points|what(?:'s| is) my (?:points|score|lifetime score|lifetime points)|points (?:do i have|today)|today['’]?s points|puntos tengo|puntos hoy|what level am i|what is my level|my level|cu[aá]ntos puntos|cu[aá]l es mi puntuaci[oó]n|cu[aá]l es mi nivel|en qu[eé] nivel|hoeveel punten|wat is mijn (?:totale )?score|welk level ben ik)\b/i.test(lower)
  ) {
    return 'SCORING_STATUS';
  }

  // E. Check-In Status (Questions about Check-In, NOT action requests)
  if (
    /\b(?:did i check[- ]?in|have i checked[- ]?in|did i do (?:my )?check[- ]?in|what was my (?:latest|last) check[- ]?in|my check[- ]?in status|check[- ]?in status)\b/i.test(lower) ||
    /\b(?:hice (?:mi )?check[- ]?in|he hecho check[- ]?in|cu[aá]l fue mi [uú]ltimo check[- ]?in|estado de mi check[- ]?in)\b/i.test(lower) ||
    /\b(?:heb ik (?:vandaag )?ingecheckt|wat was mijn laatste check[- ]?in|check[- ]?in status)\b/i.test(lower)
  ) {
    return 'CHECK_IN_STATUS';
  }

  // F. Slip / Recovery / Resume Rate Status
  if (
    /\b(?:did i slip|have i slipped|did i recover|have i recovered|did i resume|do i (?:still )?have an unresolved slip|have an unresolved slip|unresolved (?:diet )?slip|what(?:'s| is) my resume rate|my resume rate|resume rate)\b/i.test(lower) ||
    /\b(?:tuve alg[uú]n desliz|me recuper[eé] de mi desliz|tengo alg[uú]n desliz pendiente|desliz pendiente|cu[aá]l es mi tasa de resume|tasa de resume)\b/i.test(lower) ||
    /\b(?:heb ik (?:vandaag )?een uitglijder gehad|ben ik hersteld van mijn uitglijder|heb ik nog een openstaande uitglijder|openstaande uitglijder|wat is mijn resume rate)\b/i.test(lower)
  ) {
    return 'SLIP_RESUME_STATUS';
  }

  // G. Challenge Status
  if (
    /\b(?:am i doing a challenge|do i have an active challenge|active challenge|what day of my challenge|what challenge am i on|challenge status)\b/i.test(lower) ||
    /\b(?:estoy en un reto|tengo un reto activo|en qu[eé] d[ií]a de mi reto|reto activo|estado de mi reto)\b/i.test(lower) ||
    /\b(?:doe ik mee aan een challenge|heb ik een actieve challenge|op welke dag van mijn challenge|actieve challenge)\b/i.test(lower)
  ) {
    return 'CHALLENGE_STATUS';
  }

  // H. Next Best Focus / Next Move
  if (
    /\b(?:what should i focus on|what to focus on|what should i do next|what to do next|what(?:'s| is) my next (?:step|move|focus)|what do i do now|what next)\b/i.test(lower) ||
    /\b(?:en qu[eé] deber[ií]a enfocarme|qu[eé] deber[ií]a hacer ahora|cu[aá]l es mi siguiente paso|qu[eé] hago ahora)\b/i.test(lower) ||
    /\b(?:waar moet ik me (?:nu )?op focussen|wat moet ik nu doen|wat is mijn volgende stap)\b/i.test(lower)
  ) {
    return 'NEXT_BEST_FOCUS';
  }

  // I. Structured Diet Status
  if (
    /\b(?:how many (?:diet|food|meal) entries|how many (?:meals|foods) (?:have i )?logged|how am i doing with my (?:structured )?diet|how is my (?:structured )?diet|my diet today|diet status)\b/i.test(lower) ||
    /\b(?:cu[aá]ntas comidas he registrado|c[oó]mo voy con mi dieta|estado de mi dieta)\b/i.test(lower) ||
    /\b(?:hoeveel maaltijden heb ik (?:vandaag )?gelogd|hoe gaat het met mijn dieet)\b/i.test(lower)
  ) {
    return 'DIET_STATUS';
  }

  // J. Progress Summary (General "How am I doing today?")
  if (
    /\b(?:how am i doing|c[oó]mo voy|hoe doe ik het|how['’]?s my day|today['’]?s status|state of my day|daily summary|review my day|revisar mi d[ií]a|bekijk mijn dag|dagoverzicht)\b/i.test(lower)
  ) {
    return 'PROGRESS_SUMMARY';
  }

  return null;
}

/**
 * Generates an authoritative, grounded personal progress coaching response
 * based strictly on the verified CoachContext snapshot.
 */
export function generatePersonalProgressResponse(
  category: PersonalStateQueryCategory,
  context: CoachContext,
  language: 'en' | 'es' | 'nl' = 'en',
  rawMessage = ''
): string {
  const lang = language || 'en';
  const lower = rawMessage.toLowerCase();

  switch (category) {
    // ── 1. Progress Summary ("How am I doing today?") ──────────────────────────
    case 'PROGRESS_SUMMARY': {
      const todayPoints = context.scoring?.todayPoints ?? context.today?.todayScore ?? 0;
      const index = context.resumeAbility?.dailyResumeAbilityIndex ?? null;
      const checkedIn = Boolean(context.checkIn?.hasCheckedInToday ?? (context.today?.checkInCount ?? 0) > 0);
      const checkInCount = context.checkIn?.checkInCountToday ?? context.today?.checkInCount ?? 0;
      const latestStatus = context.checkIn?.latestCheckInStatus ?? context.today?.latestCheckInStatus ?? null;
      const dietEntries = context.diet?.dietEntriesLoggedToday ?? context.today?.foodLogsCount ?? 0;
      const slips = context.dietSlipResume?.dietSlipsToday ?? context.today?.slipsCount ?? 0;
      const hasUnresolved = Boolean(context.dietSlipResume?.hasUnresolvedDietSlip);
      const ac = context.challenge?.hasActiveChallenge ? context.challenge.activeChallenge : null;

      if (lang === 'es') {
        let msg = `Tienes ${todayPoints} puntos hoy y tu Índice Diario de Resume-Ability es ${index !== null ? `${index}/100` : 'aún no calculado'}.\n\n`;
        if (checkedIn) {
          const statusStr = latestStatus === 'on-structure' ? 'En Estructura' : (latestStatus === 'near-slip' ? 'Casi Desliz' : 'Desliz');
          msg += `Has hecho check-in ${checkInCount === 1 ? 'una vez' : `${checkInCount} veces`} hoy y tu estado actual es ${statusStr}. `;
        } else {
          msg += `Aún no has completado tu Daily Check-In hoy. `;
        }
        if (dietEntries > 0) {
          msg += `Has registrado ${dietEntries} ${dietEntries === 1 ? 'comida' : 'comidas'} hoy.\n\n`;
        } else {
          msg += `No has registrado comidas hoy.\n\n`;
        }
        if (slips === 0) {
          msg += `No has registrado ningún desliz verdadero hoy.`;
        } else if (hasUnresolved) {
          msg += `Tienes ${slips} desliz verdadero que aún no ha sido retomado; volver a tu estructura prevista es el enfoque principal ahora.`;
        } else {
          msg += `Tuviste ${slips} desliz verdadero hoy y lo retomaste. Ese es el comportamiento de Resume-Ability en acción.`;
        }
        if (ac) {
          msg += ` Estás en el Día ${ac.currentDay} de tu Reto de Resume-Ability de ${ac.durationDays} Días.`;
        }
        return msg;
      }

      if (lang === 'nl') {
        let msg = `Je staat vandaag op ${todayPoints} punten en je Dagelijkse Resume-Ability Index is ${index !== null ? `${index}/100` : 'nog niet berekend'}.\n\n`;
        if (checkedIn) {
          const statusStr = latestStatus === 'on-structure' ? 'Op Schema' : (latestStatus === 'near-slip' ? 'Bijna-Uitglijder' : 'Uitglijder');
          msg += `Je hebt ${checkInCount === 1 ? 'één keer' : `${checkInCount} keer`} ingecheckt en staat momenteel ${statusStr}. `;
        } else {
          msg += `Je hebt vandaag nog geen Daily Check-In gedaan. `;
        }
        if (dietEntries > 0) {
          msg += `Je hebt vandaag ${dietEntries} ${dietEntries === 1 ? 'maaltijd' : 'maaltijden'} geregistreerd.\n\n`;
        } else {
          msg += `Je hebt vandaag nog geen maaltijden geregistreerd.\n\n`;
        }
        if (slips === 0) {
          msg += `Je hebt vandaag geen echte uitglijder geregistreerd.`;
        } else if (hasUnresolved) {
          msg += `Je hebt ${slips} echte uitglijder die nog niet hervat is; terugkeren naar je schema is nu je belangrijkste focus.`;
        } else {
          msg += `Je had vandaag ${slips} echte uitglijder en hebt deze hervat. Dat is Resume-Ability in actie.`;
        }
        if (ac) {
          msg += ` Je zit op Dag ${ac.currentDay} van je ${ac.durationDays}-daagse Resume-Ability Challenge.`;
        }
        return msg;
      }

      // Default: English
      let msg = `You're at ${todayPoints} points today, and your Daily Resume-Ability Index is ${index !== null ? `${index}/100` : 'not yet calculated'}.\n\n`;
      if (checkedIn) {
        const statusStr = latestStatus === 'on-structure' ? 'On Structure' : (latestStatus === 'near-slip' ? 'Near Slip' : (latestStatus === 'slip' ? 'Slip' : 'completed'));
        msg += `You've checked in ${checkInCount === 1 ? 'once' : `${checkInCount} times`} and you're currently ${statusStr}. `;
      } else {
        msg += `You haven't completed a Daily Check-In yet today. `;
      }
      if (dietEntries > 0) {
        msg += `You've logged ${dietEntries} diet ${dietEntries === 1 ? 'entry' : 'entries'} today.\n\n`;
      } else {
        msg += `You haven't logged any diet entries today.\n\n`;
      }
      if (slips === 0) {
        msg += `You haven't recorded a true Diet Slip today.`;
      } else if (hasUnresolved) {
        msg += `You had ${slips} true Diet Slip${slips > 1 ? 's' : ''}. It has not been resumed yet, so returning to your structure is the most important thing to focus on next.`;
      } else {
        msg += `You had ${slips} true Diet Slip${slips > 1 ? 's' : ''} today and you resumed from it. That's the Resume-Ability behavior we're practicing.`;
      }
      if (ac) {
        msg += ` You're on Day ${ac.currentDay} of your ${ac.durationDays}-Day Resume-Ability Challenge.`;
      }
      return msg;
    }

    // ── 2. Scoring Status ─────────────────────────────────────────────────────
    case 'SCORING_STATUS': {
      const todayPoints = context.scoring?.todayPoints ?? context.today?.todayScore ?? 0;
      const lifetimePoints = context.scoring?.lifetimePoints ?? context.progression?.lifetimeScore ?? 0;
      const level = context.scoring?.level ?? context.progression?.level ?? 1;
      const levelTitle = context.scoring?.levelTitle ?? context.progression?.levelTitle ?? `Level ${level}`;

      const isLifetimeQuery = /lifetime|totale|acumulad/i.test(lower);
      const isLevelQuery = /level|nivel/i.test(lower);

      if (lang === 'es') {
        if (isLifetimeQuery) {
          return `Tu puntuación acumulada es de ${lifetimePoints} puntos.`;
        }
        if (isLevelQuery) {
          return `Estás en el Nivel ${level}: ${levelTitle}.`;
        }
        return `Tienes ${todayPoints} puntos hoy.`;
      }

      if (lang === 'nl') {
        if (isLifetimeQuery) {
          return `Je totale score is ${lifetimePoints} punten.`;
        }
        if (isLevelQuery) {
          return `Je bent op Level ${level}: ${levelTitle}.`;
        }
        return `Je hebt vandaag ${todayPoints} punten.`;
      }

      // English
      if (isLifetimeQuery) {
        return `Your lifetime score is ${lifetimePoints} points.`;
      }
      if (isLevelQuery) {
        return `You are Level ${level}: ${levelTitle}.`;
      }
      return `You have ${todayPoints} points today.`;
    }

    // ── 3. Daily Resume-Ability Index / Score ─────────────────────────────────
    case 'RESUME_ABILITY_STATUS': {
      const index = context.resumeAbility?.dailyResumeAbilityIndex ?? null;
      const hasUnresolved = Boolean(context.dietSlipResume?.hasUnresolvedDietSlip);
      const slips = context.dietSlipResume?.dietSlipsToday ?? 0;

      if (lang === 'es') {
        if (index === null) {
          return 'Tu Índice Diario de Resume-Ability aún no se ha calculado hoy. Registra un check-in o una comida para establecer tu índice.';
        }
        let note = `Tu Índice Diario de Resume-Ability es de ${index}/100.`;
        if (hasUnresolved) {
          note += ' Aún tienes un desliz pendiente. Retomarlo fortalecerá tu índice.';
        } else if (slips > 0) {
          note += ' Retomaste tu desliz hoy, lo cual refuerza directamente tu capacidad de recuperación.';
        }
        return note;
      }

      if (lang === 'nl') {
        if (index === null) {
          return 'Je Dagelijkse Resume-Ability Index is vandaag nog niet berekend. Doe een check-in of registreer een maaltijd om je index te bepalen.';
        }
        let note = `Je Dagelijkse Resume-Ability Index is ${index}/100.`;
        if (hasUnresolved) {
          note += ' Je hebt nog een openstaande uitglijder. Hervatten versterkt je index.';
        } else if (slips > 0) {
          note += ' Je hebt je uitglijder vandaag hervat, wat je herstelvaardigheid direct versterkt.';
        }
        return note;
      }

      // English
      if (index === null) {
        return 'Your Daily Resume-Ability Index has not been calculated yet today. Log a check-in or meal to establish your index.';
      }
      let note = `Your Daily Resume-Ability Index is ${index}/100.`;
      if (hasUnresolved) {
        note += ' You still have an unresolved Diet Slip. Returning to your structure will strengthen your index.';
      } else if (slips > 0) {
        note += ' You resumed your slip today, actively reinforcing your recovery capability.';
      }
      return note;
    }

    // ── 4. Check-In Status ────────────────────────────────────────────────────
    case 'CHECK_IN_STATUS': {
      const checkedIn = Boolean(context.checkIn?.hasCheckedInToday ?? (context.today?.checkInCount ?? 0) > 0);
      const checkInCount = context.checkIn?.checkInCountToday ?? context.today?.checkInCount ?? 0;
      const latest = context.checkIn?.latestCheckInStatus ?? context.today?.latestCheckInStatus ?? null;
      const isLatestQuery = /latest|last|[uú]ltim[oa]|laatste/i.test(lower);

      if (lang === 'es') {
        if (!checkedIn) {
          return 'Aún no has completado un Daily Check-In hoy.';
        }
        const statusStr = latest === 'on-structure' ? 'En Estructura' : (latest === 'near-slip' ? 'Casi Desliz' : 'Desliz');
        if (isLatestQuery) {
          return `Tu último check-in de hoy fue ${statusStr}.`;
        }
        return `Sí. Has hecho check-in ${checkInCount === 1 ? 'una vez' : `${checkInCount} veces`} hoy. Tu último estado es ${statusStr}.`;
      }

      if (lang === 'nl') {
        if (!checkedIn) {
          return 'Je hebt vandaag nog geen Daily Check-In gedaan.';
        }
        const statusStr = latest === 'on-structure' ? 'Op Schema' : (latest === 'near-slip' ? 'Bijna-Uitglijder' : 'Uitglijder');
        if (isLatestQuery) {
          return `Je laatste check-in van vandaag was ${statusStr}.`;
        }
        return `Ja. Je hebt vandaag ${checkInCount === 1 ? 'één keer' : `${checkInCount} keer`} ingecheckt. Je laatste status is ${statusStr}.`;
      }

      // English
      if (!checkedIn) {
        return "You haven't completed a Daily Check-In yet today.";
      }
      const statusStr = latest === 'on-structure' ? 'On Structure' : (latest === 'near-slip' ? 'Near Slip' : (latest === 'slip' ? 'Slip' : 'completed'));
      if (isLatestQuery) {
        return `Your latest check-in today was ${statusStr}.`;
      }
      return `Yes. You've checked in ${checkInCount === 1 ? 'once' : `${checkInCount} times`} today. Your latest status is ${statusStr}.`;
    }

    // ── 5. Diet Status ────────────────────────────────────────────────────────
    case 'DIET_STATUS': {
      const entries = context.diet?.dietEntriesLoggedToday ?? context.today?.foodLogsCount ?? 0;
      const onTrack = context.diet?.onTrackCountToday ?? 0;
      const twenty = context.diet?.twentyPercentCountToday ?? 0;
      const neutral = context.diet?.neutralCountToday ?? context.today?.neutralLogsCount ?? 0;
      const slips = context.dietSlipResume?.dietSlipsToday ?? context.today?.slipsCount ?? 0;
      const portions = context.diet?.totalPortions ?? context.today?.totalPortions ?? 0;

      if (lang === 'es') {
        if (entries === 0) {
          return 'Aún no has registrado comidas hoy.';
        }
        const parts: string[] = [];
        if (onTrack > 0) parts.push(`${onTrack} En Estructura`);
        if (twenty > 0) parts.push(`${twenty} 20% OFF TRACK`);
        if (neutral > 0) parts.push(`${neutral} Neutral`);
        if (slips > 0) parts.push(`${slips} Desliz`);
        const breakdown = parts.length > 0 ? `: ${parts.join(', ')}` : '';
        return `Has registrado ${entries} ${entries === 1 ? 'comida' : 'comidas'} hoy${breakdown}${portions > 0 ? ` (${portions} porciones)` : ''}.`;
      }

      if (lang === 'nl') {
        if (entries === 0) {
          return 'Je hebt vandaag nog geen maaltijden geregistreerd.';
        }
        const parts: string[] = [];
        if (onTrack > 0) parts.push(`${onTrack} Op Schema`);
        if (twenty > 0) parts.push(`${twenty} 20% OFF TRACK`);
        if (neutral > 0) parts.push(`${neutral} Neutraal`);
        if (slips > 0) parts.push(`${slips} Uitglijder`);
        const breakdown = parts.length > 0 ? `: ${parts.join(', ')}` : '';
        return `Je hebt vandaag ${entries} ${entries === 1 ? 'maaltijd' : 'maaltijden'} geregistreerd${breakdown}${portions > 0 ? ` (${portions} porties)` : ''}.`;
      }

      // English
      if (entries === 0) {
        return "You haven't logged any diet entries yet today.";
      }
      const parts: string[] = [];
      if (onTrack > 0) parts.push(`${onTrack} On Track`);
      if (twenty > 0) parts.push(`${twenty} 20% OFF TRACK`);
      if (neutral > 0) parts.push(`${neutral} Neutral`);
      if (slips > 0) parts.push(`${slips} Slip${slips > 1 ? 's' : ''}`);
      const breakdown = parts.length > 0 ? `: ${parts.join(', ')}` : '';
      return `You've logged ${entries} diet ${entries === 1 ? 'entry' : 'entries'} today${breakdown}${portions > 0 ? ` (${portions} total portions)` : ''}.`;
    }

    // ── 6. Slip & Recovery Status ─────────────────────────────────────────────
    case 'SLIP_RESUME_STATUS': {
      const slips = context.dietSlipResume?.dietSlipsToday ?? context.today?.slipsCount ?? 0;
      const resumes = context.dietSlipResume?.dietResumesToday ?? context.today?.resumedCount ?? 0;
      const hasUnresolved = Boolean(context.dietSlipResume?.hasUnresolvedDietSlip);
      const unresolvedCount = context.dietSlipResume?.unresolvedDietSlipCount ?? (hasUnresolved ? 1 : 0);
      const rate = context.dietSlipResume?.dietResumeRate ?? null;

      const isResumeRate = /resume rate|tasa de resume/i.test(lower);
      const isRecoveredQuery = /recover|recuper[eé]|herstel|did i resume/i.test(lower);
      const isUnresolvedQuery = /unresolved|pendiente|openstaand/i.test(lower);

      // A. Resume Rate
      if (isResumeRate) {
        if (lang === 'es') {
          if (rate === null) {
            return 'No tienes oportunidades de desliz elegibles hoy, por lo que aún no hay una tasa de Resume para calcular.';
          }
          return `Tu tasa de Resume hoy es del ${rate}%.`;
        }
        if (lang === 'nl') {
          if (rate === null) {
            return 'Je hebt vandaag geen in aanmerking komende uitglijders, dus er is nog geen Resume Rate te berekenen.';
          }
          return `Je Diet Resume Rate vandaag is ${rate}%.`;
        }
        if (rate === null) {
          return "You don't have any eligible Diet Slip opportunities today, so there isn't a Resume Rate to calculate yet.";
        }
        return `Your Diet Resume Rate today is ${rate}%.`;
      }

      // B. "Did I recover from my slip?"
      if (isRecoveredQuery) {
        if (lang === 'es') {
          if (slips === 0) {
            return 'No tienes ningún desliz verdadero registrado hoy, por lo que no hay una oportunidad de Resume para evaluar.';
          }
          if (!hasUnresolved) {
            return slips > 1 ? `Sí. Todos tus ${slips} deslices registrados han sido retomados.` : 'Sí. Tu desliz registrado ha sido retomado.';
          }
          return slips > 1
            ? `Tienes ${slips} deslices registrados (${resumes} retomados) y aún tienes ${unresolvedCount} pendiente${unresolvedCount > 1 ? 's' : ''}.`
            : 'Aún tienes un desliz pendiente por retomar.';
        }
        if (lang === 'nl') {
          if (slips === 0) {
            return 'Je hebt vandaag geen echte uitglijder geregistreerd, dus er is geen Resume-moment om te beoordelen.';
          }
          if (!hasUnresolved) {
            return slips > 1 ? `Ja. Al je ${slips} geregistreerde uitglijders zijn hervat.` : 'Ja. Je geregistreerde uitglijder is hervat.';
          }
          return slips > 1
            ? `Je hebt ${slips} geregistreerde uitglijders (${resumes} hervat) en nog ${unresolvedCount} openstaand${unresolvedCount > 1 ? 'e' : ''}.`
            : 'Je hebt nog een openstaande uitglijder.';
        }
        if (slips === 0) {
          return "You don't have a true Diet Slip recorded today, so there isn't a Resume opportunity to evaluate.";
        }
        if (!hasUnresolved) {
          return slips > 1 ? `Yes. All ${slips} recorded Diet Slips have been resumed.` : 'Yes. Your recorded Diet Slip has been resumed.';
        }
        return slips > 1
          ? `You have ${slips} recorded Diet Slips (${resumes} resumed) and still have ${unresolvedCount} unresolved Diet Slip${unresolvedCount > 1 ? 's' : ''}.`
          : 'You still have an unresolved Diet Slip.';
      }

      // C. "Do I have an unresolved slip?"
      if (isUnresolvedQuery) {
        if (lang === 'es') {
          if (hasUnresolved) {
            return `Sí. Tienes ${unresolvedCount > 1 ? `${unresolvedCount} deslices pendientes` : 'un desliz pendiente'} por retomar.`;
          }
          return 'No, no tienes ningún desliz pendiente.';
        }
        if (lang === 'nl') {
          if (hasUnresolved) {
            return `Ja. Je hebt nog ${unresolvedCount > 1 ? `${unresolvedCount} openstaande uitglijders` : 'een openstaande uitglijder'}.`;
          }
          return 'Nee, je hebt geen openstaande uitglijders.';
        }
        if (hasUnresolved) {
          return `Yes. You have ${unresolvedCount > 1 ? `${unresolvedCount} unresolved Diet Slips` : '1 unresolved Diet Slip'}.`;
        }
        return 'No, you do not have any unresolved Diet Slips.';
      }

      // D. "Did I slip today?" (Default)
      if (lang === 'es') {
        if (slips === 0) {
          return 'No tienes ningún desliz verdadero registrado hoy.';
        }
        return `Tienes ${slips} ${slips > 1 ? 'deslices verdaderos registrados' : 'desliz verdadero registrado'} hoy.`;
      }
      if (lang === 'nl') {
        if (slips === 0) {
          return 'Er zijn vandaag geen echte uitglijders geregistreerd.';
        }
        return `Je hebt vandaag ${slips} echte ${slips > 1 ? 'uitglijders' : 'uitglijder'} geregistreerd.`;
      }
      if (slips === 0) {
        return 'No true Diet Slips are recorded today.';
      }
      return `You have ${slips} true Diet Slip${slips > 1 ? 's' : ''} recorded today.`;
    }

    // ── 7. Challenge Status ───────────────────────────────────────────────────
    case 'CHALLENGE_STATUS': {
      const hasChallenge = Boolean(context.challenge?.hasActiveChallenge && context.challenge?.activeChallenge);
      const ac = context.challenge?.activeChallenge;

      if (lang === 'es') {
        if (!hasChallenge || !ac) {
          return 'Actualmente no tienes un reto activo de habilidad.';
        }
        return `Estás en el Día ${ac.currentDay} de tu Reto de Resume-Ability de ${ac.durationDays} Días, con ${ac.daysRemaining} días restantes.`;
      }

      if (lang === 'nl') {
        if (!hasChallenge || !ac) {
          return 'Je hebt momenteel geen actieve Ability Challenge.';
        }
        return `Je zit op Dag ${ac.currentDay} van je ${ac.durationDays}-daagse Resume-Ability Challenge, met nog ${ac.daysRemaining} dagen te gaan.`;
      }

      // English
      if (!hasChallenge || !ac) {
        return "You don't currently have an active Ability Challenge.";
      }
      return `You're on Day ${ac.currentDay} of your ${ac.durationDays}-Day Resume-Ability Challenge, with ${ac.daysRemaining} days remaining.`;
    }

    // ── 8. Next Best Focus ────────────────────────────────────────────────────
    case 'NEXT_BEST_FOCUS': {
      const hasUnresolved = Boolean(context.dietSlipResume?.hasUnresolvedDietSlip);
      const hasCheckedIn = Boolean(context.checkIn?.hasCheckedInToday ?? (context.today?.checkInCount ?? 0) > 0);
      const ac = context.challenge?.hasActiveChallenge ? context.challenge.activeChallenge : null;
      const hasDietPlan = Boolean(context.diet?.hasStructuredDiet && (context.diet?.plannedBlocksCount ?? 0) > 0);
      const hasCommitment = Boolean(
        context.commitment?.hasCommitment ||
        (context.commitment?.whyCount ?? 0) > 0 ||
        (context.nonNegotiables?.nonNegotiablesCount ?? 0) > 0
      );

      // Deterministic priority:
      // 1. Unresolved slip
      if (hasUnresolved) {
        if (lang === 'es') {
          return 'Tu enfoque más claro ahora es la Resume-Ability. Aún tienes un desliz pendiente. Volver a tu estructura prevista es la acción más significativa.';
        }
        if (lang === 'nl') {
          return 'Je belangrijkste focus nu is Resume-Ability. Je hebt nog een openstaande uitglijder. Terugkeren naar je geplande structuur is nu de meest waardevolle actie.';
        }
        return 'Your clearest next focus is Resume-Ability. You still have one unresolved Diet Slip. Returning to your intended structure is the next meaningful action.';
      }

      // 2. Daily Check-In
      if (!hasCheckedIn) {
        if (lang === 'es') {
          return 'Tu siguiente paso útil es realizar tu Daily Check-In.';
        }
        if (lang === 'nl') {
          return 'Je volgende nuttige stap is een Daily Check-In.';
        }
        return 'Your next useful step is a Daily Check-In.';
      }

      // 3. Active Challenge opportunity
      if (ac) {
        if (lang === 'es') {
          return `Enfócate en el Día ${ac.currentDay} de tu Reto de Resume-Ability. Mantén la atención en tus límites y la rapidez de recuperación.`;
        }
        if (lang === 'nl') {
          return `Focus op Dag ${ac.currentDay} van je Resume-Ability Challenge. Blijf alert op je grenzen en oefen met snel hervatten.`;
        }
        return `Focus on Day ${ac.currentDay} of your Resume-Ability Challenge. Stay mindful of your boundaries and keep practicing quick recovery.`;
      }

      // 4. Structured Diet engagement
      if (hasDietPlan) {
        if (lang === 'es') {
          return 'Enfócate en tu siguiente bloque de comida planificado.';
        }
        if (lang === 'nl') {
          return 'Focus op je volgende geplande maaltijdblok.';
        }
        return 'Focus on your next planned structure block.';
      }

      // 5. Commitment / Non-Negotiables
      if (hasCommitment) {
        if (lang === 'es') {
          return 'Recuerda tus No Negociables y tu compromiso diario como tu escudo protector.';
        }
        if (lang === 'nl') {
          return 'Houd je niet-onderhandelbare regels en commitment voor ogen als je bescherming.';
        }
        return 'Reflect on your Non-Negotiables and daily commitment as your protective boundaries.';
      }

      // 6. Maintain current structure
      if (lang === 'es') {
        return 'Estás en estructura y al día. Mantén este ritmo constante hasta tu próxima comida planificada.';
      }
      if (lang === 'nl') {
        return 'Je bent op schema en helemaal bij. Houd dit stabiele ritme vast tot je volgende geplande maaltijd.';
      }
      return "You're On Structure and up to date. Keep maintaining your steady rhythm until your next planned meal.";
    }

    // ── 9. Why / Commitment Recall ────────────────────────────────────────────
    case 'COMMITMENT_RECALL': {
      const safeReasons = context.turnScopedSensitive?.reasons || context.commitment?.reasons || [];
      const whyCount = context.commitment?.whyCount ?? safeReasons.length;

      if (safeReasons.length > 0) {
        const list = safeReasons.map((r, i) => `${i + 1}. "${r}"`).join('\n');
        if (lang === 'es') {
          return `Aquí está tu Porqué personal:\n${list}\n\nTen presente este propósito cuando sientas impulsos.`;
        }
        if (lang === 'nl') {
          return `Dit is jouw persoonlijke Waarom:\n${list}\n\nHoud dit doel voor ogen wanneer er verleiding ontstaat.`;
        }
        return `Here is your personal Why:\n${list}\n\nKeep this purpose front of mind whenever urges arise.`;
      }

      if (whyCount > 0) {
        if (lang === 'es') {
          return `Tienes ${whyCount} ${whyCount === 1 ? 'motivo personal guardado' : 'motivos personales guardados'}, pero el texto no está en el contexto seguro actual. Revisa 'Mis Compromisos' en la app para verlos.`;
        }
        if (lang === 'nl') {
          return `Je hebt ${whyCount} persoonlijke ${whyCount === 1 ? 'reden' : 'redenen'} opgeslagen, maar de tekst is niet beschikbaar in de huidige veilige context. Bekijk 'Mijn Verplichtingen' in de app.`;
        }
        return `You have ${whyCount} personal Why ${whyCount === 1 ? 'reason' : 'reasons'} saved, but the text is not included in the current safe context. Check 'My Commitments' in the app to view your reasons.`;
      }

      if (lang === 'es') {
        return 'Aún no has registrado tus razones personales. Ve a "Mis Compromisos" para escribir tu Porqué.';
      }
      if (lang === 'nl') {
        return 'Je hebt nog geen persoonlijke redenen opgeslagen. Ga naar "Mijn Verplichtingen" om je Waarom in te vullen.';
      }
      return "You haven't saved any personal Why reasons yet. Head over to 'My Commitments' to record your reasons.";
    }

    // ── 10. Non-Negotiables Recall ────────────────────────────────────────────
    case 'NON_NEGOTIABLE_RECALL': {
      const safeRules = context.turnScopedSensitive?.nonNegotiables || context.nonNegotiables?.nonNegotiables || context.commitment?.nonNegotiables || [];
      const count = context.nonNegotiables?.nonNegotiablesCount ?? safeRules.length;

      if (safeRules.length > 0) {
        const list = safeRules.map((n, i) => `${i + 1}. 🛡️ ${n}`).join('\n');
        if (lang === 'es') {
          return `Aquí están tus No Negociables:\n${list}\n\nEstos límites te protegen contra desvíos involuntarios.`;
        }
        if (lang === 'nl') {
          return `Dit zijn jouw niet-onderhandelbare regels:\n${list}\n\nDeze grenzen beschermen je tegen onbewust afdwalen.`;
        }
        return `Here are your Non-Negotiables:\n${list}\n\nThese boundaries protect you from unthinking drift.`;
      }

      if (count > 0) {
        if (lang === 'es') {
          return `Tienes ${count} ${count === 1 ? 'regla no negociable guardada' : 'reglas no negociables guardadas'}, pero el texto no está en el contexto seguro actual. Revisa 'Mis Compromisos' para verlas.`;
        }
        if (lang === 'nl') {
          return `Je hebt ${count} niet-onderhandelbare ${count === 1 ? 'regel' : 'regels'} opgeslagen, maar de tekst is niet beschikbaar in de huidige veilige context. Bekijk 'Mijn Verplichtingen'.`;
        }
        return `You have ${count} Non-Negotiable ${count === 1 ? 'rule' : 'rules'} saved, but the text is not included in the current safe context. Check 'My Commitments' to view them.`;
      }

      if (lang === 'es') {
        return 'Aún no has definido reglas No Negociables. Establecer 2 o 3 reglas en "Mis Compromisos" crea un escudo instantáneo.';
      }
      if (lang === 'nl') {
        return 'Je hebt nog geen niet-onderhandelbare regels ingesteld. Stel 2 of 3 regels in bij "Mijn Verplichtingen" voor directe bescherming.';
      }
      return "You haven't set any Non-Negotiables yet. Setting 2 or 3 firm rules in 'My Commitments' builds an instant shield.";
    }

    default:
      return "I'm here to support your structure, awareness, and recovery. What would you like to focus on right now?";
  }
}
