import type { Language } from '../i18n';

// ── Types ──

export type CoachingCategory =
  | 'emotional'
  | 'people_social'
  | 'environment'
  | 'habit'
  | 'temptation'
  | 'hunger'
  | 'celebration'
  | 'time_of_day'
  | 'delay'
  | 'all_or_nothing';

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
        body: "You didn't eat because your body needed fuel.\nYou reacted to a feeling — and food became the outlet.",
      },
      {
        title: 'Why it happens',
        body: "Emotions create a physiological urgency. When you feel stressed, anxious, sad, or frustrated, your brain's reward system searches for fast relief. Food — especially sweet or salty foods — activates dopamine and provides a temporary sense of comfort.\nThis is not a character flaw. It is a deeply wired survival pattern. The more you've used food to soothe emotions in the past, the stronger this pathway becomes.\nOver time, the trigger-to-eating reaction can happen so fast that you don't even notice the emotion that started it. The slip feels automatic — because neurologically, it nearly is.",
      },
      {
        title: 'What this tests',
        body: "This tests your Resume Ability — your capacity to pause between a feeling and an action.\nThe question is not 'why did I feel this?' but 'can I stay present with the emotion long enough for it to pass without acting on it?'\nThe timer gives you a structured container for that presence.",
      },
      {
        title: 'What to do next',
        body: "Start a 15-minute timer now. You don't need to fix the emotion — just outlast this moment.\nFocus only on getting through this single block. One at a time.\nWhen the timer ends, check in: is the feeling still at the same intensity?\nIf the urge is still strong, start another block.\nKeep going until your next planned meal if needed. Each block is a win.",
      },
    ],
  },

  people_social: {
    sections: [
      {
        title: 'What happened',
        body: 'You were around other people — and the social setting activated the urge to eat.',
      },
      {
        title: 'Why it happens',
        body: "Eating is one of the most social behaviors humans have. When others around you eat, your mirror neurons fire — literally making your brain simulate the act of eating yourself. This is why watching someone eat on screen can trigger hunger.\nBeyond imitation, social pressure adds another layer. Refusing food in a group setting can feel awkward, rude, or isolating. The brain interprets this social tension as a threat and pushes you toward the path of least resistance: just eat.\nThere is also a permission dynamic. When others eat, your internal rules often relax. The shared context creates an unspoken feeling that 'this is allowed now.' Your normal boundaries quietly dissolve in the presence of others.",
      },
      {
        title: 'What this tests',
        body: "This tests your Appetite Ability — your capacity to maintain your own boundaries even when the environment pulls in the opposite direction.\nCan you stay aligned with your own goals when social momentum is moving against them? This is one of the hardest tests, because it requires holding your position while remaining connected.",
      },
      {
        title: 'What to do next',
        body: "You don't need to explain yourself to others. Step away from the food environment if you can, even briefly.\nStart a 15-minute timer. Use this block to reconnect with your own intention.\nWhen the timer ends, decide again — from your own perspective, not the crowd's.\nIf the urge remains, start another block. Keep returning to your intention.",
      },
    ],
  },

  environment: {
    sections: [
      {
        title: 'What happened',
        body: 'Your physical surroundings — a place, a smell, a visual cue — activated the urge to eat.',
      },
      {
        title: 'Why it happens',
        body: "Your brain is a pattern-recognition machine. Every time you eat in a specific place or context, a memory trace is created. The kitchen, a coffee shop, your desk, the couch — each becomes a conditioned cue. When you re-enter that space, the associated eating behavior is automatically primed.\nThis is classical conditioning, the same mechanism Pavlov identified. The environment doesn't just remind you of food — in neurological terms, it pre-activates the reward pathway. You feel hungry because you're in a place where you've eaten before, not because your body actually needs fuel.\nSmells are especially powerful — the olfactory system has the most direct route to the brain's emotional and memory centers. A single scent can trigger a full craving cycle in seconds.",
      },
      {
        title: 'What this tests',
        body: "This tests your Delay Ability — the capacity to interrupt a conditioned response before it runs to completion.\nThe trigger happened. The urge was activated. The question now is: can you create enough space between stimulus and response to make a conscious choice?",
      },
      {
        title: 'What to do next',
        body: "If possible, physically move away from the triggering environment — even a few meters can reduce the pull.\nStart a 15-minute timer. Distance yourself long enough for the conditioned response to lose its charge.\nWhen the timer ends, reassess: has the urge dropped? Usually it will have faded significantly.\nIf it hasn't, start another block. Your brain needs time to learn that this trigger does not automatically lead to eating.",
      },
    ],
  },

  habit: {
    sections: [
      {
        title: 'What happened',
        body: 'You followed a routine — not a genuine need. The eating happened almost automatically.',
      },
      {
        title: 'Why it happens',
        body: "Habits exist to save cognitive energy. Your brain converts repeated sequences of behavior into chunks that run without conscious oversight. Once a habit is formed, it doesn't wait for your permission — it begins when the cue appears.\nFor eating habits, the cue is often a time of day, a location, or an activity sequence. 'After the meeting, I go to the kitchen.' 'When I sit at the desk, I open a snack.' These sequences have been run so many times that the behavior is nearly invisible.\nIdentifying the habit loop — cue, routine, reward — is the first step to interrupting it. But awareness alone is rarely enough in the moment. The brain needs a competing response strong enough to override the automatic pull.",
      },
      {
        title: 'What this tests',
        body: "This tests your Resume Ability — specifically, your ability to interrupt autopilot and insert a conscious pause.\nHabits are won or lost in the gap between the cue and the routine. The timer fills that gap.",
      },
      {
        title: 'What to do next',
        body: "Ask yourself right now: 'Am I actually hungry? Or is this just the usual time and place?'\nStart a 15-minute timer before acting. The act of starting the timer is itself a new routine — one that replaces the automatic response.\nFocus on waiting for the timer to finish. Nothing else.\nWhen it ends, reassess honestly. Has the hunger signal stayed constant, or faded?\nIf the habit still pulls, begin another block. Repeat until you reach your next planned meal.",
      },
    ],
  },

  temptation: {
    sections: [
      {
        title: 'What happened',
        body: 'You saw, smelled, or thought about a specific food, and the desire became overwhelming.',
      },
      {
        title: 'Why it happens',
        body: "Temptation is driven by the brain's anticipation system, not genuine hunger. When you encounter a highly palatable food — or even just its image — your brain releases a small burst of dopamine in anticipation of the reward. This is called 'wanting' (as opposed to 'liking'), and it creates an urgent, forward-pointing craving.\nThe modern food environment is designed to exploit this system. Bright colors, specific smells, and visible food are engineered to trigger maximum anticipatory dopamine. The more processed and palatable the food, the stronger the response.\nCrucially, the wanting often exceeds the actual pleasure of eating. The anticipation feels more intense than the satisfaction. This is why temptation can feel overwhelming even when you know rationally that giving in won't feel as good as you expect.",
      },
      {
        title: 'What this tests',
        body: "This tests your Appetite Ability — your capacity to tolerate the discomfort of wanting without acting on it.\nTemptation, managed well, is a form of training. Each time you outlast a craving, you weaken the pathway slightly. Each time you give in immediately, you strengthen it.",
      },
      {
        title: 'What to do next',
        body: "Don't try to suppress the thought — that usually makes it stronger. Instead, acknowledge it: 'I notice I want this.'\nStart a 15-minute timer. The craving will peak and then begin to fade — typically within 10–20 minutes.\nFocus on something that requires attention. Distraction reduces the sensory presence of the craving.\nWhen the timer ends, check the intensity. Most strong cravings lose 50–70% of their pull within one 15-minute block.\nIf still strong, start another block. Keep going.",
      },
    ],
  },

  hunger: {
    sections: [
      {
        title: 'What happened',
        body: "You felt genuinely hungry — or something that felt like hunger — and acted on it outside your plan.",
      },
      {
        title: 'Why it happens',
        body: "True hunger is a biological signal driven by ghrelin (the 'hunger hormone') rising in the stomach and blood. It rises in a wave pattern — typically every 90–120 minutes — and it does fade even without eating, before rising again.\nHowever, what feels like hunger is not always true hunger. The body can produce hunger-like signals in response to: a drop in blood sugar (which can happen after eating certain foods), boredom or mental fatigue, dehydration, and even habit. These pseudo-hunger signals mimic real hunger but are not driven by an actual caloric deficit.\nThe 15-minute test is one of the most reliable tools for distinguishing real hunger from appetite. True hunger is persistent and grows slowly. Appetite is often triggered sharply, peaks fast, and fades if you wait it out.",
      },
      {
        title: 'What this tests',
        body: "This tests your Appetite Ability — the ability to read your body's signals accurately and distinguish real hunger from reactive appetite.\nThis is a core skill of the method. Mastering it changes your relationship to food at a very fundamental level.",
      },
      {
        title: 'What to do next',
        body: "Start a 15-minute timer and observe. Don't try to suppress the feeling — just watch it.\nIf the hunger signal stays constant or grows gradually over the block, it is more likely to be real physiological hunger.\nIf it peaks quickly and then fades, it was likely appetite or a habit signal.\nWhen the timer ends, decide: is the signal still genuinely strong? If yes, start another block and continue observing.\nUse the timer to build your hunger literacy over time.",
      },
    ],
  },

  celebration: {
    sections: [
      {
        title: 'What happened',
        body: "A celebration, a special occasion, or positive emotions created an opening and you slipped outside your plan.",
      },
      {
        title: 'Why it happens',
        body: "Positive emotions can be just as destabilizing to eating plans as negative ones — but they are less often talked about. During celebrations, your guard is down. The mood is elevated, you're with people you enjoy, and the implicit message is 'today is special, the rules don't fully apply.'\nThis is a form of permission-giving — the belief that positive occasions justify exceptions. And because celebrations are associated with pleasure, the brain links food to the celebration's positive feelings, strengthening the celebratory eating pattern for next time.\nThere's also a social bonding dimension. Sharing food during celebrations is deeply wired as a form of connection. Refusing food in these moments can feel like refusing connection itself, which the brain interprets as a social threat.",
      },
      {
        title: 'What this tests',
        body: "This tests your Resume Ability — specifically the capacity to return to your plan after a positive disruption, not just a negative one.\nRecovery after celebration slips is harder than recovery after stress slips, because the memory is positive. You need to distinguish between honoring an experience and surrendering fully to it.",
      },
      {
        title: 'What to do next',
        body: "The celebration happened. It was real. Now you return.\nStart a 15-minute timer. This is not punishment — it is a reset point.\nFocus on the present block, not on what happened earlier or what the rest of the day 'should' look like.\nWhen the timer ends, you are back on track. One block at a time.\nIf needed, start another block. Let the timer mark the line between 'then' and 'now.'",
      },
    ],
  },

  time_of_day: {
    sections: [
      {
        title: 'What happened',
        body: "The time of day — a specific hour or transition — triggered the urge to eat outside your plan.",
      },
      {
        title: 'Why it happens',
        body: "The body has a circadian rhythm that extends to hunger. Ghrelin (the hunger hormone) follows a daily cycle that peaks at predictable times for each person. For many people, these peaks occur in the late morning, mid-afternoon, and evening — regardless of whether they've eaten enough.\nBeyond biology, the clock creates psychological anchors. 'After lunch,' '4pm snack,' 'evening wind-down' — these are time-tagged behaviors that become conditioned. The hour itself becomes the trigger.\nLate evening is particularly high-risk: inhibitory control in the prefrontal cortex drops as the day progresses, sleep pressure rises, and emotional regulation becomes harder. The same urge you could easily ignore at noon becomes very hard to ignore at 10pm.",
      },
      {
        title: 'What this tests',
        body: "This tests your Delay Ability — your capacity to outlast a time-based surge that is partly biological and partly conditioned.\nKnowing that this is a predictable wave — not a random failure — makes it possible to prepare for it and move through it.",
      },
      {
        title: 'What to do next',
        body: "Start a 15-minute timer. Hormonal hunger peaks are time-limited — they rise and fall in waves.\nIf this is a regular time of day when you struggle, treat the timer as a scheduled tool, not a reactive one.\nWhen the timer ends, the wave will have passed its peak. Decide with a cleaner signal.\nIf the urge is still there, start another block. The wave will continue to drop.",
      },
    ],
  },

  delay: {
    sections: [
      {
        title: 'What happened',
        body: "Waiting — for something, for someone, for a result — made the urge to eat unbearable.",
      },
      {
        title: 'Why it happens',
        body: "The human brain finds waiting deeply uncomfortable — it is a form of uncertainty, and the brain treats uncertainty as a threat that needs resolution. Eating is one of the most accessible forms of resolution available: it is immediate, sensory, and produces a brief sense of control.\nWhen you are waiting for something important — a result, a call, a decision — the anxiety of uncertainty activates the stress system. The stress system, in turn, activates the appetite system. This is why hospitals, airports, and waiting rooms are full of food.\nThere is also a displacement mechanism at work. When you can't control the thing you're waiting for, controlling your food intake feels like a release of that need to act. Eating becomes 'doing something' when you feel powerless to do anything about what matters.",
      },
      {
        title: 'What this tests',
        body: "This tests your Delay Ability — your capacity to sit with uncertainty and discomfort without reaching for an immediate resolution.\nThis is deeply connected to the core skill of the method: tolerating the space between an urge and an action.",
      },
      {
        title: 'What to do next',
        body: "Name the thing you're waiting for, even silently. Giving it a name reduces its unconscious charge.\nStart a 15-minute timer. Let the timer 'hold' the uncertainty for you — your only job is to get to the end of this block.\nNotice the difference between boredom, anxiety, and actual hunger during the block.\nWhen the timer ends, reassess. The waiting is still there — but your relationship to it may have shifted.\nIf the urge remains strong, start another block.",
      },
    ],
  },

  all_or_nothing: {
    sections: [
      {
        title: 'What happened',
        body: "After one slip or one 'bad' moment, you concluded the whole day (or week) was lost — and stopped trying.",
      },
      {
        title: 'Why it happens',
        body: "All-or-nothing thinking is one of the most common and most damaging cognitive patterns in eating behavior. It works like this: the plan was perfect. One thing deviated. Therefore the plan is ruined. Therefore it doesn't matter what happens for the rest of the period.\nThis is a false binary. In reality, the difference between one slip and a full day of unplanned eating is enormous — but all-or-nothing thinking collapses that difference completely.\nThe pattern is reinforced by perfectionism. If the goal is 'eat perfectly,' then any imperfection triggers the mental switch from 'on plan' to 'off plan.' The brain doesn't know how to hold a middle position. But this binary is learned — and it can be unlearned.\nThe crucial insight the method teaches: the slip is not the problem. How quickly you resume is the variable that matters. Ten slips with fast recovery will always produce better outcomes than one slip with a full day of abandonment.",
      },
      {
        title: 'What this tests',
        body: "This tests your Resume Ability — specifically the ability to return to your plan at any point, regardless of what has already happened.\nThe timer is your tool for making the return immediate and concrete. It turns 'I should get back on track' into a specific action starting right now.",
      },
      {
        title: 'What to do next',
        body: "The day is not lost. The next block starts now.\nStart a 15-minute timer. This is not starting over — it is resuming from exactly where you are.\nFocus only on this block. The morning doesn't exist. The evening doesn't exist yet. Just this 15 minutes.\nWhen the timer ends, you have already resumed. Start another block if needed.\nEach block you complete is evidence against the all-or-nothing belief. Build that evidence.",
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
        body: 'No comiste porque tu cuerpo necesitaba energía.\nReaccionaste a una emoción — y la comida se convirtió en la salida.',
      },
      {
        title: 'Por qué sucede',
        body: 'Las emociones crean urgencia fisiológica. Cuando sientes estrés, ansiedad, tristeza o frustración, el sistema de recompensa de tu cerebro busca alivio rápido. La comida — especialmente dulce o salada — activa la dopamina y proporciona un alivio temporal.\nEsto no es un defecto de carácter. Es un patrón de supervivencia profundamente arraigado. Cuanto más hayas usado la comida para calmar emociones en el pasado, más fuerte se vuelve esta vía neurológica.\nCon el tiempo, la reacción de disparador a comida puede ocurrir tan rápido que ni siquiera notas la emoción que la inició.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Reanudar — tu capacidad para hacer una pausa entre un sentimiento y una acción.\nLa pregunta no es "¿por qué sentí esto?" sino "¿puedo estar presente con la emoción el tiempo suficiente para que pase sin actuar sobre ella?"\nEl temporizador te da un contenedor estructurado para esa presencia.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Inicia un temporizador de 15 minutos ahora. No necesitas arreglar la emoción — solo superar este momento.\nConcéntrate solo en completar este bloque. Uno a la vez.\nCuando termine, evalúa: ¿la emoción sigue con la misma intensidad?\nSi el impulso sigue fuerte, inicia otro bloque.\nContinúa hasta tu próxima comida planificada si es necesario.',
      },
    ],
  },

  people_social: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Estabas con otras personas — y el entorno social activó el impulso de comer.',
      },
      {
        title: 'Por qué sucede',
        body: 'Comer es uno de los comportamientos más sociales que tenemos. Cuando otros a tu alrededor comen, tus neuronas espejo se activan — haciendo que tu cerebro simule literalmente el acto de comer.\nMás allá de la imitación, la presión social añade otra capa. Rechazar comida en un grupo puede sentirse incómodo o aislante. El cerebro interpreta esta tensión como una amenaza y te empuja hacia el camino de menor resistencia: simplemente comer.\nTambién hay una dinámica de permiso. Cuando otros comen, tus reglas internas se relajan. El contexto compartido crea la sensación implícita de que "ahora esto está permitido."',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Apetito — tu capacidad para mantener tus propios límites incluso cuando el entorno tira en la dirección opuesta.\n¿Puedes mantenerte alineado con tus propios objetivos cuando el impulso social va en contra de ellos?',
      },
      {
        title: 'Qué hacer ahora',
        body: 'No necesitas explicarte a los demás. Aléjate del entorno de comida si puedes, aunque sea brevemente.\nInicia un temporizador de 15 minutos. Usa este bloque para reconectar con tu propia intención.\nCuando termine, decide de nuevo — desde tu propia perspectiva, no la del grupo.\nSi el impulso persiste, inicia otro bloque.',
      },
    ],
  },

  environment: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Tu entorno físico — un lugar, un olor, una señal visual — activó el impulso de comer.',
      },
      {
        title: 'Por qué sucede',
        body: 'Tu cerebro es una máquina de reconocimiento de patrones. Cada vez que comes en un lugar o contexto específico, se crea una huella de memoria. La cocina, una cafetería, tu escritorio — cada uno se convierte en una señal condicionada. Cuando vuelves a ese espacio, el comportamiento alimentario asociado se activa automáticamente.\nEsto es condicionamiento clásico. El entorno no te recuerda la comida — neurológicamente, pre-activa la vía de recompensa. Te sientes hambriento porque estás en un lugar donde has comido antes, no porque tu cuerpo realmente necesite combustible.\nLos olores son especialmente poderosos — el sistema olfativo tiene la ruta más directa hacia los centros emocionales y de memoria del cerebro.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Retraso — la capacidad de interrumpir una respuesta condicionada antes de que se complete.\nEl disparador ocurrió. El impulso se activó. La pregunta ahora es: ¿puedes crear suficiente espacio entre estímulo y respuesta para hacer una elección consciente?',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Si es posible, muévete físicamente del entorno que activó el impulso.\nInicia un temporizador de 15 minutos. Crea distancia suficiente para que la respuesta condicionada pierda su carga.\nCuando termine, evalúa: ¿ha disminuido el impulso? Normalmente sí.\nSi no, inicia otro bloque.',
      },
    ],
  },

  habit: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Seguiste una rutina — no una necesidad real. La comida ocurrió casi automáticamente.',
      },
      {
        title: 'Por qué sucede',
        body: 'Los hábitos existen para ahorrar energía cognitiva. Tu cerebro convierte secuencias de comportamiento repetidas en bloques que se ejecutan sin supervisión consciente. Una vez formado un hábito, no espera tu permiso — comienza cuando aparece la señal.\nPara los hábitos alimentarios, la señal suele ser una hora del día, un lugar o una secuencia de actividades. "Después de la reunión, voy a la cocina." Estas secuencias se han ejecutado tantas veces que el comportamiento es casi invisible.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Reanudar — específicamente, tu capacidad de interrumpir el piloto automático e insertar una pausa consciente.\nLos hábitos se ganan o pierden en el espacio entre la señal y la rutina. El temporizador llena ese espacio.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Pregúntate ahora mismo: "¿Tengo realmente hambre? ¿O es solo la hora y el lugar de siempre?"\nInicia un temporizador de 15 minutos antes de actuar.\nConcéntrate en esperar a que termine. Nada más.\nCuando termine, reevalúa con honestidad.\nSi el hábito sigue tirando, inicia otro bloque.',
      },
    ],
  },

  temptation: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Viste, oliste o pensaste en un alimento específico, y el deseo se volvió abrumador.',
      },
      {
        title: 'Por qué sucede',
        body: 'La tentación es impulsada por el sistema de anticipación del cerebro, no por el hambre real. Cuando encuentras un alimento muy apetecible, tu cerebro libera dopamina en anticipación. Esto crea un antojo urgente.\nEl entorno alimentario moderno está diseñado para explotar este sistema. Los colores brillantes, los olores específicos y la comida visible están diseñados para desencadenar la máxima dopamina anticipatoria.\nCrucialmente, el "querer" a menudo supera el placer real de comer. La anticipación se siente más intensa que la satisfacción.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Apetito — tu capacidad para tolerar la incomodidad del deseo sin actuar sobre él.\nLa tentación, bien gestionada, es una forma de entrenamiento.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'No intentes suprimir el pensamiento — eso generalmente lo hace más fuerte. Reconócelo: "Noto que quiero esto."\nInicia un temporizador de 15 minutos. El antojo alcanzará su punto máximo y luego comenzará a desvanecerse.\nCuando termine, verifica la intensidad. La mayoría de los antojos fuertes pierden el 50-70% de su fuerza en un bloque de 15 minutos.',
      },
    ],
  },

  hunger: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Sentiste hambre real — o algo que parecía hambre — y actuaste fuera de tu plan.',
      },
      {
        title: 'Por qué sucede',
        body: 'El hambre verdadera es una señal biológica impulsada por la grelina (la "hormona del hambre") que sube en oleadas — típicamente cada 90-120 minutos — y sí disminuye incluso sin comer.\nSin embargo, lo que se siente como hambre no siempre es hambre real. El cuerpo puede producir señales similares al hambre en respuesta a: una caída en el azúcar en sangre, aburrimiento, deshidratación e incluso el hábito.\nEl hambre real es persistente y crece lentamente. El apetito a menudo se activa bruscamente, alcanza su punto máximo rápidamente y desaparece si lo esperas.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Apetito — la capacidad de leer con precisión las señales de tu cuerpo y distinguir el hambre real del apetito reactivo.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Inicia un temporizador de 15 minutos y observa. No intentes suprimir la sensación — solo obsérvala.\nSi la señal de hambre se mantiene constante o crece gradualmente durante el bloque, es más probable que sea hambre fisiológica real.\nSi alcanza su punto máximo rápidamente y luego disminuye, probablemente era apetito.\nCuando termine, decide: ¿la señal sigue genuinamente fuerte? Si es así, inicia otro bloque.',
      },
    ],
  },

  celebration: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Una celebración, una ocasión especial o emociones positivas crearon una apertura y saliste de tu plan.',
      },
      {
        title: 'Por qué sucede',
        body: 'Las emociones positivas pueden ser tan desestabilizadoras como las negativas — pero se habla menos de ellas. Durante las celebraciones, tu guardia baja. El estado de ánimo es elevado y el mensaje implícito es que "hoy es especial, las reglas no aplican del todo."\nEsto es una forma de darse permiso. Y como las celebraciones están asociadas con el placer, el cerebro vincula la comida con los sentimientos positivos.\nTambién hay una dimensión de vínculo social. Compartir comida durante celebraciones está profundamente arraigado como forma de conexión.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Reanudar — específicamente la capacidad de volver a tu plan después de una interrupción positiva, no solo una negativa.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'La celebración ocurrió. Fue real. Ahora regresas.\nInicia un temporizador de 15 minutos. Esto no es un castigo — es un punto de reinicio.\nConcéntrate en el bloque presente, no en lo que pasó antes.\nCuando termine el temporizador, estás de vuelta en el camino.',
      },
    ],
  },

  time_of_day: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'La hora del día — una hora específica o una transición — activó el impulso de comer fuera de tu plan.',
      },
      {
        title: 'Por qué sucede',
        body: 'El cuerpo tiene un ritmo circadiano que se extiende al hambre. La grelina sigue un ciclo diario que alcanza su punto máximo en momentos predecibles para cada persona, independientemente de si han comido suficiente.\nMás allá de la biología, el reloj crea anclas psicológicas. "Merienda de las 4pm", "relajación nocturna" — estos son comportamientos etiquetados por el tiempo que se convierten en condicionados.\nLa tarde-noche es especialmente de alto riesgo: el control inhibitorio cae a medida que avanza el día.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Retraso — tu capacidad para superar una oleada basada en el tiempo que es en parte biológica y en parte condicionada.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Inicia un temporizador de 15 minutos. Los picos de hambre hormonal son limitados en el tiempo — suben y bajan en oleadas.\nCuando termine el temporizador, la oleada habrá pasado su punto máximo.\nSi el impulso sigue ahí, inicia otro bloque.',
      },
    ],
  },

  delay: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Esperar — algo, alguien, un resultado — hizo que el impulso de comer se volviera insoportable.',
      },
      {
        title: 'Por qué sucede',
        body: 'El cerebro humano encuentra la espera profundamente incómoda — es una forma de incertidumbre, y el cerebro trata la incertidumbre como una amenaza. Comer es una de las formas más accesibles de resolución disponibles: es inmediata, sensorial y produce una breve sensación de control.\nCuando esperas algo importante, la ansiedad de la incertidumbre activa el sistema de estrés, que a su vez activa el sistema de apetito.\nTambién hay un mecanismo de desplazamiento: cuando no puedes controlar lo que esperas, controlar tu ingesta de comida se siente como una liberación.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Retraso — tu capacidad de sentarte con la incertidumbre sin alcanzar una resolución inmediata.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'Nombra la cosa que estás esperando, aunque sea en silencio. Darle un nombre reduce su carga inconsciente.\nInicia un temporizador de 15 minutos. Deja que el temporizador "sostenga" la incertidumbre por ti.\nCuando termine, reevalúa. La espera sigue ahí — pero tu relación con ella puede haber cambiado.',
      },
    ],
  },

  all_or_nothing: {
    sections: [
      {
        title: 'Qué pasó',
        body: 'Después de un desliz o un momento "malo", concluiste que todo el día (o la semana) estaba perdido — y dejaste de intentarlo.',
      },
      {
        title: 'Por qué sucede',
        body: 'El pensamiento de todo o nada es uno de los patrones cognitivos más comunes y más dañinos en el comportamiento alimentario. Funciona así: el plan era perfecto. Una cosa se desvió. Por lo tanto el plan está arruinado. Por lo tanto no importa lo que suceda el resto del período.\nEsto es un falso binario. En realidad, la diferencia entre un desliz y un día entero de comer sin planificar es enorme — pero el pensamiento de todo o nada colapsa esa diferencia.\nLa intuición crucial que enseña el método: el desliz no es el problema. La rapidez con la que reanudas es la variable que importa.',
      },
      {
        title: 'Qué evalúa esto',
        body: 'Evalúa tu Capacidad de Reanudar — específicamente la capacidad de volver a tu plan en cualquier momento, independientemente de lo que ya haya pasado.',
      },
      {
        title: 'Qué hacer ahora',
        body: 'El día no está perdido. El siguiente bloque comienza ahora.\nInicia un temporizador de 15 minutos. Esto no es empezar de nuevo — es reanudar desde exactamente donde estás.\nConcéntrate solo en este bloque. Nada más existe ahora mismo.\nCuando termine el temporizador, ya has reanudado.',
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
        body: 'Je at niet omdat je lichaam brandstof nodig had.\nJe reageerde op een gevoel — en eten werd de uitlaatklep.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Emoties creëren fysiologische urgentie. Wanneer je stress, angst, verdriet of frustratie voelt, zoekt het beloningssysteem van je brein naar snel herstel. Eten — vooral zoet of zout — activeert dopamine en biedt tijdelijke verlichting.\nDit is geen karakterfout. Het is een diep geworteld overlevingspatroon. Hoe vaker je eten hebt gebruikt om emoties te kalmeren, hoe sterker dit neurale pad wordt.\nMet de tijd kan de reactie zo snel gaan dat je de uitlokkende emotie niet eens opmerkt.',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Hervatsingsvermogen — je capaciteit om een pauze te creëren tussen een gevoel en een actie.\nDe vraag is niet "waarom voelde ik dit?" maar "kan ik aanwezig blijven bij de emotie lang genoeg voor die voorbijgaat zonder erop te handelen?"\nDe timer geeft je een gestructureerde container voor die aanwezigheid.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Start nu een timer van 15 minuten. Je hoeft de emotie niet op te lossen — overleef alleen dit moment.\nRicht je alleen op het voltooien van dit blok. Één tegelijk.\nAls de timer afloopt, check in: is het gevoel nog even sterk?\nAls de drang nog sterk is, start een nieuw blok.\nGa door tot je volgende geplande maaltijd als dat nodig is.',
      },
    ],
  },

  people_social: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Je was bij andere mensen — en de sociale omgeving activeerde de drang om te eten.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Eten is een van de meest sociale gedragingen die mensen hebben. Wanneer anderen om je heen eten, vuren je spiegelneuronen — je brein simuleert letterlijk het eten zelf.\nBoven op imitatie voegt sociale druk een extra laag toe. Voedsel weigeren in een groep kan ongemakkelijk of isolerend aanvoelen. Het brein interpreteert deze sociale spanning als een bedreiging.\nEr is ook een permissiedynamiek: wanneer anderen eten, ontspannen je interne regels. De gedeelde context creëert het impliciete gevoel dat "dit nu oké is."',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Eetlustcapaciteit — je capaciteit om je eigen grenzen te handhaven, zelfs wanneer de omgeving de tegenovergestelde richting intrekt.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Je hoeft niets aan anderen uit te leggen. Verwijder je van de voedselomgeving als dat kan.\nStart een timer van 15 minuten. Gebruik dit blok om opnieuw contact te maken met je eigen intentie.\nAls de timer afloopt, beslis opnieuw — vanuit je eigen perspectief, niet dat van de groep.',
      },
    ],
  },

  environment: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Je fysieke omgeving — een plek, een geur, een visuele hint — activeerde de drang om te eten.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Je brein is een patroonherkenningsapparaat. Elke keer dat je op een specifieke plek eet, wordt er een geheugenspoor aangemaakt. De keuken, een café, je bureau, de bank — elk wordt een geconditioneerde hint. Wanneer je die ruimte opnieuw betreedt, wordt het bijbehorende eetgedrag automatisch geactiveerd.\nDit is klassieke conditionering. De omgeving herinnert je niet alleen aan eten — neurologisch gezien pre-activeert het het beloningspad.\nGeuren zijn bijzonder krachtig — het olfactorische systeem heeft de meest directe route naar de emotionele en geheugencentra van het brein.',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Uitstelvermogen — de capaciteit om een geconditioneerde respons te onderbreken voordat die volledig wordt uitgevoerd.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Beweeg fysiek weg van de omgeving die de drang activeerde als dat mogelijk is.\nStart een timer van 15 minuten. Creëer genoeg afstand voor de geconditioneerde respons zijn lading verliest.\nAls de timer afloopt, beoordeel opnieuw: is de drang afgenomen?',
      },
    ],
  },

  habit: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Je volgde een routine — geen echte behoefte. Het eten gebeurde bijna automatisch.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Gewoonten bestaan om cognitieve energie te besparen. Je brein zet herhaalde gedragssequenties om in blokken die zonder bewuste aansturing worden uitgevoerd. Eenmaal gevormd, wacht een gewoonte niet op je toestemming — het begint wanneer de aanwijzing verschijnt.\nVoor eetgewoonten is de aanwijzing vaak een tijdstip, een locatie of een activiteitenreeks. Deze sequenties zijn zo vaak uitgevoerd dat het gedrag bijna onzichtbaar is.',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Hervatsingsvermogen — specifiek je capaciteit om de automatische piloot te onderbreken en een bewuste pauze in te voegen.\nGewoonten worden gewonnen of verloren in het gat tussen de aanwijzing en de routine. De timer vult dat gat.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Vraag jezelf nu: "Heb ik echt honger? Of is dit gewoon de gebruikelijke tijd en plek?"\nStart een timer van 15 minuten voor je handelt.\nRicht je op wachten tot de timer afloopt. Niets anders.\nAls hij afloopt, beoordeel opnieuw eerlijk.',
      },
    ],
  },

  temptation: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Je zag, rook of dacht aan een specifiek voedsel, en het verlangen werd overweldigend.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Verleiding wordt aangedreven door het anticipatiesysteem van het brein, niet door echte honger. Wanneer je een smakelijk voedsel tegenkomt, laat je brein een kleine dopamineburst los in anticipatie op de beloning. Dit creëert een urgent, voorwaarts gericht verlangen.\nDe moderne voedselomgeving is ontworpen om dit systeem te exploiteren. Felle kleuren, specifieke geuren en zichtbaar voedsel zijn ontworpen voor maximale anticiperende dopamine.\nCrucially overtreft het "willen" vaak het werkelijke genot van eten. De anticipatie voelt intenser aan dan de voldoening.',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Eetlustcapaciteit — je capaciteit om het ongemak van willen te verdragen zonder erop te handelen.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Probeer de gedachte niet te onderdrukken — dat maakt hem meestal sterker. Erken het: "Ik merk dat ik dit wil."\nStart een timer van 15 minuten. Het verlangen zal pieken en dan beginnen te verdwijnen.\nAls de timer afloopt, controleer de intensiteit. De meeste sterke verlangens verliezen 50-70% van hun kracht binnen één blok.',
      },
    ],
  },

  hunger: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Je voelde echte honger — of iets dat aanvoelde als honger — en handelde buiten je plan.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Echte honger is een biologisch signaal gedreven door ghreline dat in golven stijgt — typisch elke 90-120 minuten — en ja, afneemt zelfs zonder te eten.\nWat aanvoelt als honger is echter niet altijd echte honger. Het lichaam kan hongergelijke signalen produceren als reactie op een bloedsuikerdaling, verveling, uitdroging en zelfs gewoonte.\nEchte honger is persistent en groeit langzaam. Eetlust wordt vaak scherp getriggerd, piekt snel en verdwijnt als je het afwacht.',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Eetlustcapaciteit — het vermogen om de signalen van je lichaam nauwkeurig te lezen en echte honger van reactieve eetlust te onderscheiden.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Start een timer van 15 minuten en observeer. Probeer het gevoel niet te onderdrukken — kijk er alleen naar.\nAls het hongersignaal constant blijft of geleidelijk groeit, is het waarschijnlijker echte fysiologische honger.\nAls het snel piekt en dan afneemt, was het waarschijnlijk eetlust.\nAls de timer afloopt, beslis: is het signaal nog steeds echt sterk? Zo ja, start een nieuw blok.',
      },
    ],
  },

  celebration: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Een viering, een bijzondere gelegenheid of positieve emoties creëerden een opening en je stapte buiten je plan.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Positieve emoties kunnen net zo destabiliserend zijn voor eetplannen als negatieve — maar er wordt minder over gesproken. Tijdens vieringen daalt je waakzaamheid. De stemming is verheven en de impliciete boodschap is dat "vandaag speciaal is, de regels gelden niet volledig."\nDit is een vorm van toestemming geven. En omdat vieringen worden geassocieerd met plezier, koppelt het brein eten aan de positieve gevoelens.\nEr is ook een sociale bindingsdimensie. Eten delen tijdens vieringen is diep geworteld als een vorm van verbinding.',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Hervatsingsvermogen — specifiek de capaciteit om terug te keren naar je plan na een positieve verstoring.',
      },
      {
        title: 'Wat nu te doen',
        body: 'De viering is er geweest. Het was echt. Nu keer je terug.\nStart een timer van 15 minuten. Dit is geen straf — het is een herstelpunt.\nRicht je op het huidige blok, niet op wat eerder is gebeurd.\nAls de timer afloopt, ben je terug op de goede weg.',
      },
    ],
  },

  time_of_day: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Het tijdstip van de dag — een specifiek uur of overgang — activeerde de drang om buiten je plan te eten.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Het lichaam heeft een circadiaans ritme dat zich uitstrekt tot honger. Ghreline volgt een dagelijkse cyclus die op voorspelbare tijden piekt voor elke persoon, ongeacht of ze genoeg hebben gegeten.\nBehalve biologie creëert de klok ook psychologische ankerpunten. "4-uur snack", "avondontspanning" — dit zijn tijdsgebonden gedragingen die geconditioneerd worden.\nLaat in de avond is bijzonder risicovol: de remmende controle daalt naarmate de dag vordert.',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Uitstelvermogen — je capaciteit om een tijdgebonden piek te doorstaan die deels biologisch en deels geconditioneerd is.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Start een timer van 15 minuten. Hormonale hongerppieken zijn tijdgebonden — ze stijgen en dalen in golven.\nAls de timer afloopt, is de golf voorbij zijn piek gegaan.\nAls de drang er nog is, start een nieuw blok.',
      },
    ],
  },

  delay: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Wachten — op iets, iemand, een resultaat — maakte de drang om te eten ondraaglijk.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Het menselijk brein vindt wachten diep ongemakkelijk — het is een vorm van onzekerheid, en het brein behandelt onzekerheid als een bedreiging die moet worden opgelost. Eten is een van de meest toegankelijke vormen van oplossing: het is onmiddellijk, sensorisch, en produceert een kort gevoel van controle.\nWanneer je op iets belangrijks wacht, activeert de angst van de onzekerheid het stresssysteem, dat vervolgens het eetlustsysteem activeert.\nEr is ook een verplaatsingsmechanisme: wanneer je de situatie niet kunt beheersen, voelt het beheersen van je voedselinname als een bevrijding.',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Uitstelvermogen — je capaciteit om met onzekerheid te zitten zonder te reiken naar een onmiddellijke oplossing.',
      },
      {
        title: 'Wat nu te doen',
        body: 'Benoem de zaak waarop je wacht, zelfs stilletjes. Een naam geven vermindert de onbewuste lading.\nStart een timer van 15 minuten. Laat de timer de onzekerheid voor je "vasthouden."\nAls de timer afloopt, beoordeel opnieuw. Het wachten is er nog — maar je relatie ermee kan zijn verschoven.',
      },
    ],
  },

  all_or_nothing: {
    sections: [
      {
        title: 'Wat er gebeurde',
        body: 'Na één misstap of één "slecht" moment, concludeerde je dat de hele dag (of week) verloren was — en stopte met proberen.',
      },
      {
        title: 'Waarom dit gebeurt',
        body: 'Alles-of-niets-denken is een van de meest voorkomende en schadelijkste cognitieve patronen bij eetgedrag. Het werkt zo: het plan was perfect. Eén ding week af. Dus het plan is verpest. Dus het maakt niet uit wat er de rest van de periode gebeurt.\nDit is een vals zwart-witdenken. In werkelijkheid is het verschil tussen één misstap en een hele dag onbeheerst eten enorm.\nDe cruciale inzicht: de misstap is niet het probleem. Hoe snel je hervat, is de variabele die telt.',
      },
      {
        title: 'Wat dit test',
        body: 'Dit test je Hervatsingsvermogen — specifiek de capaciteit om op elk moment terug te keren naar je plan, ongeacht wat er al is gebeurd.',
      },
      {
        title: 'Wat nu te doen',
        body: 'De dag is niet verloren. Het volgende blok begint nu.\nStart een timer van 15 minuten. Dit is niet opnieuw beginnen — het is hervatten vanaf precies waar je bent.\nRicht je alleen op dit blok. Niets anders bestaat nu.\nAls de timer afloopt, heb je al hervat.',
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
