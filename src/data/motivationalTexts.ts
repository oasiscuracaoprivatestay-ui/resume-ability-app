/**
 * motivationalTexts.ts — Motivational Text Content Architecture (Phase 19)
 *
 * Provides a structured, extensible library for motivational readings.
 * Designed to be future-ready for:
 * - Library expansion (categories, tags, reflections)
 * - Paid / free content gating in Phase 24 (via optional isPremium flag)
 * - Multilingual resolution across English, Spanish, and Dutch
 */

export type MotivationalCategory =
  | 'mindset'
  | 'urges'
  | 'resilience'
  | 'calm'
  | 'boundaries'
  | 'discipline';

export interface MotivationalTextItem {
  id: string;
  category: MotivationalCategory;
  title: string;
  body: string;
  isPremium?: boolean;
}

export interface LocalizedMotivationalText {
  id: string;
  category: MotivationalCategory;
  isPremium?: boolean;
  en: { title: string; body: string };
  es: { title: string; body: string };
  nl: { title: string; body: string };
}

export const INITIAL_MOTIVATIONAL_TEXTS: LocalizedMotivationalText[] = [
  {
    id: 'text-1',
    category: 'mindset',
    en: {
      title: 'One Decision at a Time',
      body: 'You do not need to solve the whole day right now. Choose the next structured action. One conscious decision is enough to change the direction of this moment.',
    },
    es: {
      title: 'Una decisión a la vez',
      body: 'No necesitas resolver todo el día ahora mismo. Elige la siguiente acción estructurada. Una decisión consciente basta para cambiar el rumbo de este momento.',
    },
    nl: {
      title: 'Eén beslissing tegelijk',
      body: 'Je hoeft niet de hele dag nu op te lossen. Kies de volgende gestructureerde actie. Eén bewuste keuze is genoeg om de koers van dit moment te veranderen.',
    },
  },
  {
    id: 'text-2',
    category: 'urges',
    en: {
      title: 'Urges Are Not Commands',
      body: 'Urges can feel urgent without being commands. Notice what is happening, reconnect with your Why, and choose your next step deliberately.',
    },
    es: {
      title: 'Los impulsos no son órdenes',
      body: 'Los impulsos pueden sentirse urgentes sin ser obligatorios. Observa lo que sucede, reconecta con tu Porqué y elige tu siguiente paso deliberadamente.',
    },
    nl: {
      title: 'Drang is geen bevel',
      body: 'Een verlangen kan dringend aanvoelen zonder een bevel te zijn. Merk op wat er gebeurt, maak opnieuw contact met je Waarom en kies bewust je volgende stap.',
    },
  },
  {
    id: 'text-3',
    category: 'resilience',
    en: {
      title: 'Progress Remains',
      body: 'Progress is not lost because of one difficult moment. Resume-Ability begins the moment you decide to return to your structure.',
    },
    es: {
      title: 'El progreso permanece',
      body: 'El progreso no se destruye por un momento difícil. Resume-Ability comienza en el instante en que decides regresar a tu estructura.',
    },
    nl: {
      title: 'Vooruitgang blijft behouden',
      body: 'Vooruitgang gaat niet verloren door één moeilijk moment. Resume-Ability begint op het moment dat je besluit terug te keren naar je structuur.',
    },
  },
  {
    id: 'text-4',
    category: 'calm',
    en: {
      title: 'Pause and Breathe',
      body: 'Take a deep breath and pause the momentum of the craving. The craving is temporary, but the strength of your commitment lasts.',
    },
    es: {
      title: 'Pausa y respira',
      body: 'Toma una respiración profunda y frena el impulso del antojo. La tentación es temporal, pero la fuerza de tu compromiso perdura.',
    },
    nl: {
      title: 'Pauzeer en adem',
      body: 'Haal diep adem en breek het momentum van de impuls. De hunkering is tijdelijk, maar de kracht van jouw toewijding blijft.',
    },
  },
  {
    id: 'text-5',
    category: 'boundaries',
    en: {
      title: 'Honor Your Boundaries',
      body: 'Your non-negotiables exist to protect your peace and your long-term goals. Upholding them now is an investment in your self-trust.',
    },
    es: {
      title: 'Honra tus límites',
      body: 'Tus no-negociables existen para proteger tu tranquilidad y tus objetivos a largo plazo. Mantenerlos ahora fortalece la confianza en ti mismo.',
    },
    nl: {
      title: 'Eer je grenzen',
      body: 'Je non-negotiables beschermen jouw gemoedsrust en langetermijndoelen. Ze nu naleven is een directe investering in zelfvertrouwen.',
    },
  },
  {
    id: 'text-6',
    category: 'mindset',
    en: {
      title: 'Notice Without Judgment',
      body: 'Step back from frustration. Observing your triggers without self-criticism gives you the clarity you need to stay on track.',
    },
    es: {
      title: 'Observa sin juzgar',
      body: 'Toma distancia de la frustración. Observar tus detonantes sin criticarte te da la claridad que necesitas para mantener el rumbo.',
    },
    nl: {
      title: 'Observeer zonder oordeel',
      body: 'Neem afstand van frustratie. Het observeren van je triggers zonder zelfkritiek geeft je de helderheid die je nodig hebt om op koers te blijven.',
    },
  },
  {
    id: 'text-7',
    category: 'resilience',
    en: {
      title: 'Resume-Ability in Action',
      body: 'Mastery is not having zero temptations. Mastery is knowing how to return the instant you feel yourself drifting.',
    },
    es: {
      title: 'Resume-Ability en acción',
      body: 'La maestría no consiste en no tener tentaciones, sino en saber cómo regresar en el mismo instante en que sientes que te desvías.',
    },
    nl: {
      title: 'Resume-Ability in actie',
      body: 'Meesterschap betekent niet dat je nooit verleiding voelt. Meesterschap is weten hoe je terugkeert zodra je merkt dat je afdwaalt.',
    },
  },
  {
    id: 'text-8',
    category: 'discipline',
    en: {
      title: 'Small Resets Matter',
      body: 'Every single time you choose your plan over an impulse, your mental discipline grows stronger. You are capable of handling this moment.',
    },
    es: {
      title: 'Cada pequeño reinicio cuenta',
      body: 'Cada vez que eliges tu plan por encima de un impulso, tu disciplina mental se hace más fuerte. Tienes la capacidad de afrontar este momento.',
    },
    nl: {
      title: 'Kleine resets doen ertoe',
      body: 'Elke keer dat je jouw plan verkiest boven een impuls, wordt je mentale discipline sterker. Je bent in staat dit moment te hanteren.',
    },
  },
  {
    id: 'text-9',
    category: 'discipline',
    en: {
      title: 'The Power of the Next Meal',
      body: 'Do not carry a difficult moment forward into the rest of the day. Reset your focus immediately and align with your next scheduled window.',
    },
    es: {
      title: 'El poder de la siguiente comida',
      body: 'No arrastres un momento complicado hacia el resto de la jornada. Reinicia tu enfoque de inmediato y sincronízate con tu próxima ventana.',
    },
    nl: {
      title: 'De kracht van de volgende maaltijd',
      body: 'Draag een lastig moment niet mee naar de rest van de dag. Reset je focus direct en sluit aan bij je volgende geplande eetvenster.',
    },
  },
  {
    id: 'text-10',
    category: 'mindset',
    en: {
      title: 'You Are in Charge',
      body: 'The environment and the habit loop may pull at your attention, but the final choice always belongs to you. Choose what serves your future.',
    },
    es: {
      title: 'Tú tienes el control',
      body: 'El entorno y el hábito pueden llamar tu atención, pero la decisión final siempre es tuya. Elige lo que favorece a tu futuro.',
    },
    nl: {
      title: 'Jij hebt de regie',
      body: 'De omgeving en gewoonteloops trekken aan je aandacht, maar de uiteindelijke keuze is altijd aan jou. Kies wat jouw toekomst dient.',
    },
  },
  {
    id: 'prem-text-1',
    category: 'discipline',
    isPremium: true,
    en: {
      title: 'The Neuroscience of Craving Surges',
      body: 'Dopamine surges signal anticipation, not command. When you notice a sudden appetite wave, your nervous system is simply predicting a familiar reward. By waiting 10 minutes within your structured frame, the chemical spike naturally subsides, establishing lasting neural independence.',
    },
    es: {
      title: 'La neurociencia de los impulsos intensos',
      body: 'Las oleadas de dopamina señalan anticipación, no una orden. Cuando notas un antojo repentino, tu sistema nervioso simplemente predice una recompensa habitual. Al esperar 10 minutos dentro de tu estructura, el pico químico disminuye de forma natural, consolidando tu autonomía neurológica.',
    },
    nl: {
      title: 'De neurowetenschap van plotselinge drang',
      body: 'Dopaminepieken signaleren anticipatie, geen bevel. Wanneer je een plotselinge hunkering voelt, voorspelt je zenuwstelsel slechts een bekende beloning. Door 10 minuten binnen je structuur te pauzeren, zakt de chemische piek vanzelf weg en bouw je blijvende neurale veerkracht op.',
    },
  },
  {
    id: 'prem-text-2',
    category: 'resilience',
    isPremium: true,
    en: {
      title: 'The 72-Hour Momentum Window',
      body: 'Behavioral research reveals that recovering immediately from a slip within the first 72 hours solidifies identity more than unbroken streaks. Each conscious return to your structure proves that your ability to resume is unconditional.',
    },
    es: {
      title: 'La ventana de impulso de 72 horas',
      body: 'La investigación conductual demuestra que recuperarse inmediatamente de un desliz dentro de las primeras 72 horas fortalece tu identidad más que una racha perfecta. Cada regreso consciente a tu estructura demuestra que tu capacidad de retomar es incondicional.',
    },
    nl: {
      title: 'Het 72-uurs momentumvenster',
      body: 'Gedragswetenschap toont aan dat direct herstellen na een slip binnen de eerste 72 uur je identiteit sterker bevestigt dan een vlekkeloze reeks. Elke bewuste terugkeer naar je structuur bewijst dat jouw Resume-Ability onvoorwaardelijk is.',
    },
  },
  {
    id: 'prem-text-3',
    category: 'mindset',
    isPremium: true,
    en: {
      title: 'Identity Beyond Food Decisions',
      body: 'Your core worth is never on trial at the dining table. When you disconnect your identity from daily food fluctuations, choices cease to be emotional battles and become calm, routine executions of your chosen life structure.',
    },
    es: {
      title: 'Identidad más allá de las decisiones alimentarias',
      body: 'Tu valor personal nunca está a prueba frente a la mesa. Cuando desvinculas tu identidad de las fluctuaciones alimentarias diarias, las elecciones dejan de ser batallas emocionales y se convierten en la ejecución serena y rutinaria de tu estructura elegida.',
    },
    nl: {
      title: 'Identiteit voorbij voedingskeuzes',
      body: 'Je eigenwaarde staat nooit op het spel aan de eettafel. Wanneer je je identiteit loskoppelt van dagelijkse voedingsschommelingen, zijn keuzes geen emotionele strijd meer, maar een kalme, routinematige uitvoering van jouw gekozen structuur.',
    },
  },
];

/**
 * Retrieve motivational texts localized to the specified language.
 */
export function getMotivationalTexts(lang: 'en' | 'es' | 'nl' = 'en'): MotivationalTextItem[] {
  return INITIAL_MOTIVATIONAL_TEXTS.map((item) => ({
    id: item.id,
    category: item.category,
    isPremium: item.isPremium ?? false,
    title: item[lang]?.title || item.en.title,
    body: item[lang]?.body || item.en.body,
  }));
}

/**
 * Retrieve ONLY free motivational texts localized to the specified language.
 */
export function getFreeMotivationalTexts(lang: 'en' | 'es' | 'nl' = 'en'): MotivationalTextItem[] {
  return getMotivationalTexts(lang).filter((t) => !t.isPremium);
}

// ══════════════════════════════════════════════════════════════════════════════
// POST CHECK-IN MOTIVATIONAL QUOTES (Phase 20)
// Context-specific messages reinforcing Consistency (On Structure),
// Awareness (Near Slip), and Recovery (Slip).
// ══════════════════════════════════════════════════════════════════════════════

export type CheckInMotivationContext = 'on-structure' | 'near-slip' | 'slip';

export interface PostCheckInQuoteItem {
  id: string;
  context: CheckInMotivationContext;
  en: string;
  es: string;
  nl: string;
}

export const POST_CHECKIN_QUOTES: PostCheckInQuoteItem[] = [
  // ── ON STRUCTURE: Consistency, momentum, self-trust ──
  {
    id: 'quote-os-1',
    context: 'on-structure',
    en: 'Consistency is not about perfection. It is about choosing your structure one conscious moment at a time.',
    es: 'La constancia no se trata de perfección. Se trata de elegir tu estructura un momento consciente a la vez.',
    nl: 'Consistentie gaat niet over perfectie. Het gaat over het kiezen van je structuur, één bewust moment tegelijk.',
  },
  {
    id: 'quote-os-2',
    context: 'on-structure',
    en: 'Every time you honor your boundaries, you strengthen your peace and long-term self-trust.',
    es: 'Cada vez que honras tus límites, fortaleces tu tranquilidad y la confianza en ti mismo.',
    nl: 'Elke keer dat je je grenzen eert, versterk je je rust en zelfvertrouwen op de lange termijn.',
  },
  {
    id: 'quote-os-3',
    context: 'on-structure',
    en: 'Structure gives you freedom; consistency gives you mastery. Keep moving forward.',
    es: 'La estructura te da libertad; la constancia te da maestría. Sigue avanzando.',
    nl: 'Structuur geeft je vrijheid; consistentie geeft je meesterschap. Blijf vooruitgaan.',
  },
  {
    id: 'quote-os-4',
    context: 'on-structure',
    en: 'Small conscious choices compound into lasting mental resilience.',
    es: 'Las pequeñas elecciones conscientes se acumulan en una resistencia mental duradera.',
    nl: 'Kleine bewuste keuzes stapelen zich op tot blijvende mentale veerkracht.',
  },

  // ── NEAR SLIP: Awareness, pausing cravings, choosing control ──
  {
    id: 'quote-ns-1',
    context: 'near-slip',
    en: 'Urges feel urgent without being commands. Noticing the trigger and pausing is where your control begins.',
    es: 'Los impulsos se sienten urgentes sin ser órdenes. Notar el detonante y hacer una pausa es donde empieza tu control.',
    nl: 'Een verlangen voelt dringend zonder een bevel te zijn. Het opmerken van de trigger en pauzeren is waar jouw regie begint.',
  },
  {
    id: 'quote-ns-2',
    context: 'near-slip',
    en: 'Awareness turns an impulse into a choice. You paused the craving and protected your direction.',
    es: 'La consciencia convierte un impulso en una elección. Frenaste el antojo y protegiste tu rumbo.',
    nl: 'Bewustzijn verandert een impuls in een keuze. Je pauzeerde het verlangen en beschermde je koers.',
  },
  {
    id: 'quote-ns-3',
    context: 'near-slip',
    en: 'Mastery is knowing how to pause before action. Trust your ability to stay grounded in this moment.',
    es: 'La maestría es saber pausar antes de actuar. Confía en tu capacidad para mantenerte firme en este momento.',
    nl: 'Meesterschap is weten hoe je pauzeert voor actie. Vertrouw op je vermogen om gegrond te blijven.',
  },
  {
    id: 'quote-ns-4',
    context: 'near-slip',
    en: 'A craving is temporary, but the strength of keeping your non-negotiables lasts.',
    es: 'Un antojo es pasajero, pero la fuerza de mantener tus no-negociables perdura.',
    nl: 'Een hunkering is tijdelijk, maar de kracht van het vasthouden aan je non-negotiables blijft.',
  },

  // ── SLIP: Recovery, data over guilt, returning to structure ──
  {
    id: 'quote-sl-1',
    context: 'slip',
    en: 'A slip is simply data, not a failure. Progress continues the moment you decide to return to your structure.',
    es: 'Un desliz es solo información, no un fracaso. El progreso continúa en el instante en que decides regresar a tu estructura.',
    nl: 'Een slip is simpelweg data, geen falen. Vooruitgang gaat verder zodra je besluit terug te keren naar je structuur.',
  },
  {
    id: 'quote-sl-2',
    context: 'slip',
    en: 'Resume-Ability is your power. One conscious reset changes the momentum of your entire day.',
    es: 'Resume-Ability es tu poder. Un reinicio consciente cambia el rumbo de toda tu jornada.',
    nl: 'Resume-Ability is jouw kracht. Eén bewuste reset verandert het momentum van je hele dag.',
  },
  {
    id: 'quote-sl-3',
    context: 'slip',
    en: 'Do not carry a past moment forward. Reconnect with your plan at the next meal with calm focus.',
    es: 'No arrastres un momento pasado. Reconecta con tu plan en la siguiente comida con enfoque sereno.',
    nl: 'Draag een vorig moment niet met je mee. Sluit bij de volgende maaltijd weer aan bij je plan met kalme focus.',
  },
  {
    id: 'quote-sl-4',
    context: 'slip',
    en: 'You don’t need perfection. You need the ability to return.',
    es: 'No necesitas perfección. Necesitas la capacidad de regresar.',
    nl: 'Je hebt geen perfectie nodig. Je hebt het vermogen nodig om terug te keren.',
  },
];

/**
 * Retrieve a context-tailored motivational quote item for the post-checkin experience.
 */
export function getPostCheckInQuoteItem(
  context: CheckInMotivationContext = 'on-structure'
): PostCheckInQuoteItem {
  const pool = POST_CHECKIN_QUOTES.filter((q) => q.context === context);
  const candidates = pool.length > 0 ? pool : POST_CHECKIN_QUOTES;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Retrieve a context-tailored motivational quote text for the post-checkin experience.
 */
export function getPostCheckInQuote(
  context: CheckInMotivationContext = 'on-structure',
  lang: 'en' | 'es' | 'nl' = 'en'
): string {
  const item = getPostCheckInQuoteItem(context);
  return item[lang] || item.en;
}
