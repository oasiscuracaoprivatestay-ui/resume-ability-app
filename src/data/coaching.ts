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
        body: 'This is your ability to stay present without reacting.',
      },
      {
        title: 'What to do next',
        body: 'Pause. Breathe. Wait 15 minutes.\nLet the emotion settle before you act again.',
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
        body: 'Your awareness and interruption ability.',
      },
      {
        title: 'What to do next',
        body: 'Step away. Break the pattern.\nChange your environment or delay the action.',
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
        body: 'Your ability to interrupt autopilot behavior.',
      },
      {
        title: 'What to do next',
        body: 'Pause and ask: "Am I actually hungry?"\nDelay the habit and observe the urge.',
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
        body: 'Your ability to distinguish hunger vs appetite.',
      },
      {
        title: 'What to do next',
        body: 'Wait 15 minutes.\nIf hunger is real, it will remain stable.',
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
        body: 'Your recovery speed.',
      },
      {
        title: 'What to do next',
        body: 'Reset immediately.\nOne action does not define the rest of your day.',
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
        body: 'Tu capacidad de estar presente sin reaccionar.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Pausa. Respira. Espera 15 minutos.\nDeja que la emoción se calme antes de actuar.',
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
        body: 'Tu conciencia y capacidad de interrupción.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Aléjate. Rompe el patrón.\nCambia tu entorno o retrasa la acción.',
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
        body: 'Tu capacidad de interrumpir el comportamiento automático.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Pausa y pregúntate: "¿Realmente tengo hambre?"\nRetrasa el hábito y observa el impulso.',
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
        body: 'Tu capacidad de distinguir hambre de apetito.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Espera 15 minutos.\nSi el hambre es real, se mantendrá estable.',
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
        body: 'Tu velocidad de recuperación.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Reinicia de inmediato.\nUna acción no define el resto de tu día.',
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
        body: 'Je vermogen om aanwezig te blijven zonder te reageren.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Pauzeer. Adem. Wacht 15 minuten.\nLaat de emotie zakken voordat je weer handelt.',
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
        body: 'Je bewustzijn en vermogen om te onderbreken.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Loop weg. Doorbreek het patroon.\nVerander je omgeving of stel de actie uit.',
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
        body: 'Je vermogen om automatisch gedrag te onderbreken.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Pauzeer en vraag: "Heb ik echt honger?"\nStel de gewoonte uit en observeer de drang.',
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
        body: 'Je vermogen om honger van eetlust te onderscheiden.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Wacht 15 minuten.\nAls de honger echt is, blijft die stabiel.',
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
        body: 'Je herstelsnelheid.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Herstel onmiddellijk.\nEén actie bepaalt niet de rest van je dag.',
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
