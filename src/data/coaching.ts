import type { Language } from '../i18n';

// ── Types ──

export type CoachingCategory =
  | 'emotional'
  | 'trigger'
  | 'habit'
  | 'not_hungry'
  | 'loss_of_control';

export interface CoachingSection {
  title: string;
  body: string;
}

export interface CoachingContent {
  sections: CoachingSection[];
}

type CoachingLocale = Record<CoachingCategory, CoachingContent>;

// ══════════════════════════════════════════════
//   ENGLISH
// ══════════════════════════════════════════════

const en: CoachingLocale = {
  emotional: {
    sections: [
      {
        title: 'What happened',
        body: "You didn't eat because your body needed fuel.\nYou reacted to a feeling.",
      },
      {
        title: 'Why it happens',
        body: 'Emotions create urgency.\nYour brain is trying to regulate discomfort quickly.',
      },
      {
        title: 'What this tests',
        body: 'Your ability to stay present without reacting.\nThe timer gives you a structured way to hold that space.',
      },
      {
        title: 'What to do next',
        body: 'Start a 15-minute timer now.\nFocus only on getting through this block.\nWhen the timer ends, check in with yourself again.\nIf the urge is still there, start another block.\nKeep going until your next planned meal if needed.',
      },
    ],
  },
  trigger: {
    sections: [
      {
        title: 'What happened',
        body: 'Something in your environment triggered the urge to eat.',
      },
      {
        title: 'Why it happens',
        body: 'Your brain links places, people, and moments with food.',
      },
      {
        title: 'What this tests',
        body: 'Your awareness and ability to interrupt the pattern.\nThe timer creates a gap between the trigger and your response.',
      },
      {
        title: 'What to do next',
        body: 'Step away from the trigger and start a 15-minute timer.\nUse the timer to create distance from the urge.\nWhen it ends, decide again with a clear head.\nIf the pull is still strong, start another block.\nContinue until the moment passes or until your next meal.',
      },
    ],
  },
  habit: {
    sections: [
      {
        title: 'What happened',
        body: 'You followed a routine, not a real need.',
      },
      {
        title: 'Why it happens',
        body: 'Your brain runs automatic patterns to save energy.',
      },
      {
        title: 'What this tests',
        body: 'Your ability to interrupt autopilot behavior.\nThe timer replaces the automatic response with a conscious pause.',
      },
      {
        title: 'What to do next',
        body: 'Ask yourself: "Am I actually hungry?"\nStart a 15-minute timer before acting.\nFocus on waiting for the timer to finish.\nWhen it ends, reassess honestly.\nIf the habit still pulls, begin another block.\nRepeat until you reach your next planned meal.',
      },
    ],
  },
  not_hungry: {
    sections: [
      {
        title: 'What happened',
        body: "You felt like eating, but it wasn't hunger.",
      },
      {
        title: 'Why it happens',
        body: 'Cravings often mimic hunger signals.',
      },
      {
        title: 'What this tests',
        body: 'Your ability to distinguish real hunger from appetite.\nThe timer helps you test whether the feeling is genuine.',
      },
      {
        title: 'What to do next',
        body: 'Start a 15-minute timer and wait.\nReal hunger stays steady. Cravings fade.\nWhen the timer ends, check again: is the feeling still there?\nIf yes, start another block and observe.\nContinue until the craving fades or your next meal arrives.',
      },
    ],
  },
  loss_of_control: {
    sections: [
      {
        title: 'What happened',
        body: 'You acted quickly without awareness.',
      },
      {
        title: 'Why it happens',
        body: 'Strong impulses override conscious decisions.',
      },
      {
        title: 'What this tests',
        body: 'Your recovery speed.\nThe timer is your immediate reset tool.',
      },
      {
        title: 'What to do next',
        body: 'Start a 15-minute timer right now.\nOne action does not define the rest of your day.\nFocus only on this block. Nothing else.\nWhen it ends, decide: continue or reset.\nIf needed, start another block and keep going.\nUse the timer to reclaim the rest of your day.',
      },
    ],
  },
};

// ══════════════════════════════════════════════
//   ESPAÑOL
// ══════════════════════════════════════════════

const es: CoachingLocale = {
  emotional: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'No comiste porque tu cuerpo necesitaba energía.\nReaccionaste a una emoción.',
      },
      {
        title: 'Por qué sucede',
        body: 'Las emociones crean urgencia.\nTu cerebro intenta regular la incomodidad rápidamente.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Tu capacidad de estar presente sin reaccionar.\nEl temporizador te da una forma estructurada de sostener ese espacio.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Inicia un temporizador de 15 minutos ahora.\nConcéntrate solo en completar este bloque.\nCuando termine, vuelve a evaluar cómo te sientes.\nSi el impulso sigue, inicia otro bloque.\nContinúa hasta tu próxima comida planificada si es necesario.',
      },
    ],
  },
  trigger: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Algo en tu entorno activó el impulso de comer.',
      },
      {
        title: 'Por qué sucede',
        body: 'Tu cerebro asocia lugares, personas y momentos con la comida.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Tu conciencia y capacidad de interrupción.\nEl temporizador crea una pausa entre el disparador y tu respuesta.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Aléjate del disparador e inicia un temporizador de 15 minutos.\nUsa el temporizador para crear distancia del impulso.\nCuando termine, decide de nuevo con la mente clara.\nSi la atracción sigue fuerte, inicia otro bloque.\nContinúa hasta que el momento pase o llegue tu próxima comida.',
      },
    ],
  },
  habit: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Seguiste una rutina, no una necesidad real.',
      },
      {
        title: 'Por qué sucede',
        body: 'Tu cerebro ejecuta patrones automáticos para ahorrar energía.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Tu capacidad de interrumpir el comportamiento automático.\nEl temporizador reemplaza la respuesta automática con una pausa consciente.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Pregúntate: "¿Realmente tengo hambre?"\nInicia un temporizador de 15 minutos antes de actuar.\nConcéntrate en esperar a que termine.\nCuando termine, reevalúa con honestidad.\nSi el hábito sigue tirando, inicia otro bloque.\nRepite hasta llegar a tu próxima comida planificada.',
      },
    ],
  },
  not_hungry: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Sentiste ganas de comer, pero no era hambre.',
      },
      {
        title: 'Por qué sucede',
        body: 'Los antojos a menudo imitan las señales de hambre.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Tu capacidad de distinguir hambre real de apetito.\nEl temporizador te ayuda a probar si la sensación es genuina.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Inicia un temporizador de 15 minutos y espera.\nEl hambre real se mantiene estable. Los antojos se desvanecen.\nCuando termine, vuelve a comprobar: ¿sigue la sensación?\nSi es así, inicia otro bloque y observa.\nContinúa hasta que el antojo pase o llegue tu próxima comida.',
      },
    ],
  },
  loss_of_control: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Actuaste rápido sin conciencia.',
      },
      {
        title: 'Por qué sucede',
        body: 'Los impulsos fuertes anulan las decisiones conscientes.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Tu velocidad de recuperación.\nEl temporizador es tu herramienta de reinicio inmediato.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Inicia un temporizador de 15 minutos ahora mismo.\nUna acción no define el resto de tu día.\nConcéntrate solo en este bloque. Nada más.\nCuando termine, decide: continuar o reiniciar.\nSi es necesario, inicia otro bloque y sigue adelante.\nUsa el temporizador para recuperar el resto de tu día.',
      },
    ],
  },
};

// ══════════════════════════════════════════════
//   NEDERLANDS
// ══════════════════════════════════════════════

const nl: CoachingLocale = {
  emotional: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Je at niet omdat je lichaam brandstof nodig had.\nJe reageerde op een gevoel.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Emoties creëren urgentie.\nJe brein probeert ongemak snel te reguleren.',
      },
      {
        title: 'Wat dit test',
        body: 'Je vermogen om aanwezig te blijven zonder te reageren.\nDe timer geeft je een gestructureerde manier om die ruimte vast te houden.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Start nu een timer van 15 minuten.\nRicht je alleen op het voltooien van dit blok.\nAls de timer afloopt, check opnieuw hoe je je voelt.\nAls de drang er nog is, start een nieuw blok.\nGa door tot je volgende geplande maaltijd als dat nodig is.',
      },
    ],
  },
  trigger: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Iets in je omgeving activeerde de drang om te eten.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Je brein koppelt plaatsen, mensen en momenten aan eten.',
      },
      {
        title: 'Wat dit test',
        body: 'Je bewustzijn en vermogen om te onderbreken.\nDe timer creëert een pauze tussen de trigger en je reactie.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Loop weg van de trigger en start een timer van 15 minuten.\nGebruik de timer om afstand te creëren van de drang.\nAls hij afloopt, beslis opnieuw met een helder hoofd.\nAls de aantrekkingskracht sterk blijft, start een nieuw blok.\nGa door tot het moment voorbij is of tot je volgende maaltijd.',
      },
    ],
  },
  habit: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Je volgde een routine, geen echte behoefte.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Je brein draait automatische patronen om energie te besparen.',
      },
      {
        title: 'Wat dit test',
        body: 'Je vermogen om automatisch gedrag te onderbreken.\nDe timer vervangt de automatische reactie door een bewuste pauze.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Vraag jezelf: "Heb ik echt honger?"\nStart een timer van 15 minuten voordat je handelt.\nRicht je op wachten tot de timer afloopt.\nAls hij afloopt, beoordeel opnieuw eerlijk.\nAls de gewoonte blijft trekken, start een nieuw blok.\nHerhaal tot je volgende geplande maaltijd.',
      },
    ],
  },
  not_hungry: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Je had zin om te eten, maar het was geen honger.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Verlangen bootst vaak hongersignalen na.',
      },
      {
        title: 'Wat dit test',
        body: 'Je vermogen om echte honger van eetlust te onderscheiden.\nDe timer helpt je te testen of het gevoel echt is.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Start een timer van 15 minuten en wacht.\nEchte honger blijft stabiel. Verlangen verdwijnt.\nAls de timer afloopt, check opnieuw: is het gevoel er nog?\nZo ja, start een nieuw blok en observeer.\nGa door tot het verlangen verdwijnt of je volgende maaltijd komt.',
      },
    ],
  },
  loss_of_control: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Je handelde snel zonder bewustzijn.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Sterke impulsen overschrijven bewuste beslissingen.',
      },
      {
        title: 'Wat dit test',
        body: 'Je herstelsnelheid.\nDe timer is je directe hersteltool.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Start nu meteen een timer van 15 minuten.\nEén actie bepaalt niet de rest van je dag.\nRicht je alleen op dit blok. Niets anders.\nAls hij afloopt, beslis: doorgaan of resetten.\nStart indien nodig een nieuw blok en ga verder.\nGebruik de timer om de rest van je dag terug te winnen.',
      },
    ],
  },
};

// ══════════════════════════════════════════════
//   EXPORTS
// ══════════════════════════════════════════════

const COACHING_CONTENT: Record<Language, CoachingLocale> = { en, es, nl };

/**
 * Get coaching content for a category in the given language.
 * Falls back to English if the language entry is missing.
 */
export function getCoaching(
  lang: Language,
  category: CoachingCategory,
): CoachingContent {
  const locale = COACHING_CONTENT[lang] ?? COACHING_CONTENT.en;
  return locale[category] ?? COACHING_CONTENT.en[category];
}
