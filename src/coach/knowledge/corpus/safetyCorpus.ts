/**
 * SDA Authoritative Knowledge Corpus — Safety Boundaries & Protocols (Phase 36B.1)
 *
 * Source: Authoritative Sergio Laurant Manuscripts (Book 7 Ch 27-29, Book 6 Ch 23, Book 4 Ch 4).
 * Safety Distinction:
 * - MANUSCRIPT_EXPLICIT: Stated directly by Sergio Laurant in the manuscripts (e.g. stop fast immediately
 *   on concerning distress symptoms; medical prescription orders strictly override dietary windows).
 * - SYSTEM_SAFETY: Product guardrails, medical escalation mandates, and liability boundaries
 *   implemented for safe digital product operation.
 */

import type { SafetyProtocol, SDAKnowledgeUnit } from '../types';

export const SDA_SAFETY_PROTOCOLS: Record<string, SafetyProtocol> = {
  emergency_symptoms_stop_rule: {
    id: 'emergency_symptoms_stop_rule',
    title: 'Emergency Stop Rules During Fasting or Caloric Restriction',
    condition:
      'User experiences dizziness, lightheadedness, confusion, severe/progressive weakness, shaking, chest pain, palpitations, or persistent vomiting.',
    prohibitedActions: [
      'NEVER tell the user to "push through", "tough it out", or "it is just your body detoxing".',
      'NEVER diagnose the cause of the symptom.',
      'NEVER encourage continuing a fast or delay consuming food/fluids.',
    ],
    mandatoryEscalation:
      'Instruct user to IMMEDIATELY stop fasting, sit or lie down safely, consume electrolytes or a gentle meal/beverage with sugar/carbohydrates if hypoglycemic, and seek urgent medical evaluation if chest pain, severe palpitations, fainting, or severe symptoms persist.',
    emergencySymptoms: [
      'fainting or syncope',
      'confusion or disorientation',
      'severe weakness or inability to stand',
      'persistent significant dizziness',
      'substantial physical shaking or tremors',
      'chest pain or pressure',
      'difficulty breathing or shortness of breath',
      'significant palpitations or racing irregular heart rate',
      'persistent vomiting',
    ],
    sourceRef: 'SDA_Book_07:Chapter_29',
    sourceAuthority: 'MANUSCRIPT_EXPLICIT',
    sourceBook: 'Book 7: Micro-Fasting Ability',
    sourceChapter: 'Chapter 29: Stop Rules and Concerning Symptoms',
    sourceReference: 'SDA_Book_07_Micro-Fasting-Ability.docx:Chapter_29',
    safetyType: 'medical_red_flag',
  },

  fasting_contraindicated_populations: {
    id: 'fasting_contraindicated_populations',
    title: 'Absolute and Relative Contraindications for Extended Fasting',
    condition:
      'User is pregnant, breastfeeding, a minor (under 18), has a history of an active eating disorder (anorexia, bulimia), or has severe chronic wasting disease.',
    prohibitedActions: [
      'NEVER recommend or clear extended fasting or severe caloric restriction.',
      'NEVER suggest that fasting during pregnancy or breastfeeding is harmless.',
      'NEVER trigger or encourage restrictive fasting behaviors in someone with an eating disorder history.',
    ],
    mandatoryEscalation:
      'Inform the user that extended fasting is medically contraindicated for their population. Emphasize nourishing, regular whole-food meals and guide them to their obstetrician, pediatrician, or specialized healthcare provider.',
    emergencySymptoms: [],
    sourceRef: 'SDA_Book_07:Chapter_28',
    sourceAuthority: 'MANUSCRIPT_EXPLICIT',
    sourceBook: 'Book 7: Micro-Fasting Ability',
    sourceChapter: 'Chapter 28: Who Should Not Fast or Needs Medical Supervision',
    sourceReference: 'SDA_Book_07_Micro-Fasting-Ability.docx:Chapter_28',
    safetyType: 'contraindication',
  },

  medication_and_diabetes_boundary: {
    id: 'medication_and_diabetes_boundary',
    title: 'Medication Timing and Diabetic Hypoglycemia Safeguards',
    condition:
      'User is taking prescription medications (especially insulin, sulfonylureas, blood pressure medications, or drugs required with food).',
    prohibitedActions: [
      'NEVER advise changing, skipping, reducing, or adjusting prescription medication dosages.',
      'NEVER advise delaying a meal if a medication requires food consumption.',
      'NEVER encourage unmonitored fasting for insulin-dependent diabetics.',
    ],
    mandatoryEscalation:
      'Reiterate that medical orders strictly override any dietary schedule or fasting window. The user must consult their prescribing physician to adjust medications before altering meal timing or carbohydrate intake.',
    emergencySymptoms: [
      'hypoglycemic sweating',
      'cold clammy skin',
      'confusion or slurred speech',
      'severe tremors',
    ],
    sourceRef: 'SDA_Book_06:Chapter_23; SDA_Book_04:Chapter_04',
    sourceAuthority: 'MANUSCRIPT_EXPLICIT',
    sourceBook: 'Book 6: Circadian Eating Ability & Book 4: Insulin-Aware Ability',
    sourceChapter: 'Book 6 Ch 23 & Book 4 Ch 04',
    sourceReference: 'SDA_Book_06_Circadian-Eating-Ability.docx:Chapter_23; SDA_Book_04_Insulin-Aware-Ability.docx:Chapter_04',
    safetyType: 'product_guardrail',
  },

  scope_of_practice_boundary: {
    id: 'scope_of_practice_boundary',
    title: 'SDA Coach Scope of Practice Boundary',
    condition: 'User asks for medical diagnosis, treatment plan, lab test interpretation, or medical clearance.',
    prohibitedActions: [
      'NEVER diagnose a medical condition or disease.',
      'NEVER prescribe medical nutrition therapy for acute disease management.',
      'NEVER issue medical clearance for fasting or exercise.',
    ],
    mandatoryEscalation:
      'State clearly that the SDA AI Coach is a behavioral habit and mindset guide grounded in Sergio Laurant’s Super Diet-Ability methodology, not a licensed medical provider. Refer the user to their qualified physician for medical decisions.',
    emergencySymptoms: [],
    sourceRef: 'System Safety Disclaimer / Terms of Service',
    sourceAuthority: 'SYSTEM_SAFETY',
    sourceBook: 'System Guardrails',
    sourceChapter: 'N/A',
    sourceReference: 'Product Clinical Scope Boundary',
    safetyType: 'disclaimer',
  },
};

export const SAFETY_KNOWLEDGE_UNITS: SDAKnowledgeUnit[] = [
  {
    id: 'sda_safety_unit_stop_rules',
    abilityId: 'safety',
    bookNumber: 7,
    bookTitle: 'Micro-Fasting Ability',
    chapter: 29,
    chapterTitle: 'Stop Rules and Concerning Symptoms',
    topicTags: ['safety', 'stop_rules', 'fainting', 'dizziness', 'emergency'],
    concepts: ['Immediate Termination Protocol', 'Safety Above All', 'Non-Negotiable Medical Boundary'],
    terminology: ['Stop Rules', 'Red Flag Symptoms'],
    content:
      'A stop rule is a decision made in advance defining when a fast ends immediately. If you experience dizziness, confusion, abnormal weakness, shaking, chest pain, palpitations, or persistent vomiting, the fast terminates on the spot. Sit down, nourish your body, and contact a physician. An app can say NO to a target; an app can NEVER clear you medically.',
    coachingApplication:
      'Immediately escalate to safety guidance if any symptom is reported. Never prioritize fasting goals over physiological well-being.',
    prohibitedAssumptions: [
      'Do not attempt to explain away symptoms as "normal keto flu" if the user feels severely unwell.',
    ],
    sourceRef: 'SDA_Book_07:Chapter_29',
    authority: 'level1_manuscript',
    sourceAuthority: 'MANUSCRIPT_EXPLICIT',
    safetyClassification: 'safety_boundary',
    relatedAbilities: ['micro_fasting_ability', 'resume_ability'],
    relatedAppFeatures: ['timer', 'coach'],
  },

  {
    id: 'sda_safety_unit_medications_hierarchy',
    abilityId: 'safety',
    bookNumber: 6,
    bookTitle: 'Circadian Eating Ability',
    chapter: 23,
    chapterTitle: 'Health, Medication, and Individual Circumstances',
    topicTags: ['safety', 'medication', 'medical_primacy', 'doctor_orders'],
    concepts: ['Medical Primacy Hierarchy', 'Medication Safety', 'Doctor Orders First'],
    terminology: ['The Health Hierarchy', 'Medication Primacy'],
    content:
      'Medical orders and prescription schedules always override dietary structure or fasting ideals. If your doctor or medication requires food at a specific time, you eat. Health safety is the supreme priority.',
    coachingApplication:
      'Remind users with medical conditions or medications that their health care plan is sovereign.',
    prohibitedAssumptions: [
      'Do not recommend overriding prescription instructions for any SDA goal.',
    ],
    sourceRef: 'SDA_Book_06:Chapter_23',
    authority: 'level1_manuscript',
    sourceAuthority: 'MANUSCRIPT_EXPLICIT',
    safetyClassification: 'safety_boundary',
    relatedAbilities: ['circadian_eating_ability', 'insulin_aware_ability'],
    relatedAppFeatures: ['neutral_log', 'coach'],
  },
];
