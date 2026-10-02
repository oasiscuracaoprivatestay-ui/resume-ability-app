/**
 * SDA AI Coach — Structured Knowledge Base Builder (Phase 35)
 *
 * Provider-independent, RAG-ready knowledge registry for Super Diet-Ability.
 * Centralizes principles, terms, topics, and strict knowledge gap detection.
 */

import type { AbilityId } from '../types';
import type {
  KnowledgeGap,
  SDAKnowledgeBase,
  SDAKnowledgeTopic,
  SDAPrinciple,
  SDAPrincipleId,
  SDATerm,
  SDATermKey,
} from './types';
import { SDA_PRINCIPLES } from './sdaPrinciples';
import { SDA_TERMINOLOGY } from './sdaTerminology';

export const SDA_KNOWLEDGE_TOPICS: SDAKnowledgeTopic[] = [
  {
    id: 'sda_core_framework',
    ability: 'diet',
    title: 'Super Diet-Ability Behavioral Framework',
    summary: 'SDA is a behavioral mastery system built on awareness, chosen structure, and resilient recovery.',
    content: 'Super Diet-Ability centers on awareness over perfection. The goal is not a rigid dogma or never slipping, but transforming relationship with food through observable structure and rapid resume capability.',
    keywords: ['sda', 'super diet ability', 'framework', 'methodology', 'awareness', 'perfection'],
    relatedTopicIds: ['sda_resume_ability', 'sda_structure_and_planning'],
    sourceIds: ['coaching.ts'],
    status: 'defined',
  },
  {
    id: 'sda_resume_ability',
    ability: 'diet',
    title: 'Resume-Ability & Recovery Dynamics',
    summary: 'Resume-Ability is the capacity to pause between feeling and action, returning to structure immediately.',
    content: 'Resume is an independent dimension of measurement that coexists with a slip. Resuming does not erase the slip, but measures the speed and resilience of the return.',
    keywords: ['resume', 'resume-ability', 'recovery', 'bounce back', 'return', 'pause'],
    relatedTopicIds: ['sda_slips_and_recovery', 'sda_core_framework'],
    sourceIds: ['coaching.ts', 'dietVerificationStorage.ts'],
    status: 'defined',
  },
  {
    id: 'sda_structure_and_planning',
    ability: 'diet',
    title: 'Structure vs Planning Distinction',
    summary: 'Structure describes alignment with intentional boundaries; planning is merely advance scheduling.',
    content: 'Unplanned food choices are not automatically unstructured. A user can make a spontaneous, mindful choice that remains completely on-track.',
    keywords: ['structure', 'structured diet', 'planned', 'unplanned', 'spontaneous', 'boundaries'],
    relatedTopicIds: ['sda_core_framework', 'sda_twenty_percent_buffer'],
    sourceIds: ['sda_term_sd', 'dietVerificationStorage.ts'],
    status: 'defined',
  },
  {
    id: 'sda_slips_and_recovery',
    ability: 'diet',
    title: 'Slips as Behavioral Information',
    summary: 'Slips are valuable observation points, not failures or reasons to abandon the rest of the day.',
    content: 'Reporting a slip never deducts points. Slips are divided into Structured Slips and Unstructured Slips. The coaching focus is immediate non-shaming exploration and orientation toward resuming.',
    keywords: ['slip', 'structured slip', 'unstructured slip', 'mistake', 'off track', 'reporting'],
    relatedTopicIds: ['sda_resume_ability', 'sda_near_slips'],
    sourceIds: ['scoringEngine.ts', 'coaching.ts'],
    status: 'defined',
  },
  {
    id: 'sda_twenty_percent_buffer',
    ability: 'diet',
    title: '20% OFF TRACK Flexibility Buffer',
    summary: 'An intentional on-track buffer designed for psychological sustainability and real-world flexibility.',
    content: '20% OFF TRACK is an On-Track outcome, not a slip. It earns positive score points and is strictly excluded from slip counts and resume calculations.',
    keywords: ['20% off track', 'buffer', 'flexibility', '80/20', 'balance', 'on track'],
    relatedTopicIds: ['sda_structure_and_planning', 'sda_core_framework'],
    sourceIds: ['dietVerificationStorage.ts'],
    status: 'defined',
  },
  {
    id: 'sda_near_slips',
    ability: 'diet',
    title: 'Near-Slip Awareness Boundary',
    summary: 'Pausing and stopping before crossing a boundary represents high awareness and self-regulation.',
    content: 'A Near-Slip is when an urge is experienced but halted before slipping. It does not count as a slip and does not count as a resume event.',
    keywords: ['near slip', 'close call', 'urge', 'stopped', 'resisted', 'boundary'],
    relatedTopicIds: ['sda_slips_and_recovery', 'sda_slippery_zones'],
    sourceIds: ['checkInStorage.ts'],
    status: 'defined',
  },
  {
    id: 'sda_slippery_zones',
    ability: 'diet',
    title: 'Slippery Zones as Risk Contexts',
    summary: 'High-risk situations or emotional states that make drift more likely without acting as deterministic causes.',
    content: 'Identifying slippery zones (e.g. fatigue, social events, emotional stress) builds advance awareness. The coach explores whether a zone was relevant without claiming causation.',
    keywords: ['slippery zone', 'triggers', 'stress', 'late night', 'social pressure', 'environment'],
    relatedTopicIds: ['sda_near_slips', 'sda_commitment_and_why'],
    sourceIds: ['sda_term_sz', 'coaching.ts'],
    status: 'defined',
  },
  {
    id: 'sda_commitment_and_why',
    ability: 'diet',
    title: 'Personal Why & Non-Negotiables',
    summary: 'Internal anchors and shields defined by the user to ground decisions during moments of high urge.',
    content: 'The coach always references the user\'s real saved Why and Non-Negotiables. If none are saved, the coach invites reflection rather than fabricating generic motivators.',
    keywords: ['commitment', 'why', 'non-negotiable', 'motivation', 'values', 'anchor'],
    relatedTopicIds: ['sda_core_framework', 'sda_slippery_zones'],
    sourceIds: ['coaching.ts', 'sda_term_nn'],
    status: 'defined',
  },
  {
    id: 'sda_seven_diet_abilities',
    ability: 'diet',
    title: 'The Seven Diet-Abilities (Partial Codification)',
    summary: 'Broader system of diet-abilities; only Resume Ability, Appetite Ability, and Delay Ability appear in current source.',
    content: 'While the broader SDA philosophy includes seven distinct abilities, only Resume Ability, Appetite Ability, and Delay Ability are explicitly documented in current source code. The remaining abilities await official curriculum codification.',
    keywords: ['seven diet abilities', '7 abilities', 'diet abilities', 'mastery curriculum'],
    relatedTopicIds: ['sda_resume_ability'],
    sourceIds: ['coaching.ts'],
    status: 'partial',
  },
  {
    id: 'super_abilities_ecosystem',
    ability: 'diet',
    title: 'Super Ability Multi-Domain Ecosystem (Reserved)',
    summary: 'Future expansion modules (Productivity, Time Management, Money, Organization, Entrepreneurship).',
    content: 'The architecture reserves identifiers for other life mastery domains. These remain inactive and uncodified in Phase 35.',
    keywords: ['productivity', 'time management', 'organizer', 'money', 'entrepreneurship'],
    relatedTopicIds: [],
    sourceIds: ['branding.ts'],
    status: 'reserved',
  },
];

class DefaultSDAKnowledgeBase implements SDAKnowledgeBase {
  readonly ability: AbilityId = 'diet';

  getTerm(key: SDATermKey): SDATerm | undefined {
    return SDA_TERMINOLOGY[key];
  }

  findTerm(query: string): SDATerm | undefined {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;

    // Exact key match
    if (q in SDA_TERMINOLOGY) {
      return SDA_TERMINOLOGY[q as SDATermKey];
    }

    // Normalized match
    const terms = Object.values(SDA_TERMINOLOGY);
    return terms.find(t => 
      t.key.toLowerCase() === q ||
      t.displayName.toLowerCase() === q ||
      t.displayName.toLowerCase().replace(/[^a-z0-9]/g, '') === q.replace(/[^a-z0-9]/g, '')
    );
  }

  getAllTerms(): SDATerm[] {
    return Object.values(SDA_TERMINOLOGY);
  }

  getPrinciple(id: SDAPrincipleId): SDAPrinciple | undefined {
    return SDA_PRINCIPLES[id];
  }

  getAllPrinciples(): SDAPrinciple[] {
    return Object.values(SDA_PRINCIPLES);
  }

  getTopic(id: string): SDAKnowledgeTopic | undefined {
    return SDA_KNOWLEDGE_TOPICS.find(t => t.id === id);
  }

  getAllTopics(): SDAKnowledgeTopic[] {
    return SDA_KNOWLEDGE_TOPICS;
  }

  checkKnowledgeGap(query: string): KnowledgeGap | null {
    const lower = query.toLowerCase();

    // 1. Reserved Super Abilities check
    const reservedAbilities: Record<string, string> = {
      productivity: 'Super Productivity Ability',
      'time-management': 'Super Time-Management Ability',
      'time management': 'Super Time-Management Ability',
      organizer: 'Super Organizer Ability',
      money: 'Super Money Ability',
      entrepreneurship: 'Super Entrepreneurship Ability',
    };

    for (const [trigger, name] of Object.entries(reservedAbilities)) {
      if (lower.includes(trigger)) {
        return {
          requestedTopic: name,
          status: 'reserved',
          reason: `${name} is a reserved future module in the Super Ability ecosystem.`,
          fallbackMessage: `I am currently focused on Super Diet-Ability (SDA). ${name} is reserved for a future release and is not yet available in the app.`,
        };
      }
    }

    // 2. Seven Diet-Abilities queries beyond the 3 source-supported
    if (
      lower.includes('seven diet') ||
      lower.includes('7 diet') ||
      lower.includes('seven abilities') ||
      lower.includes('all abilities')
    ) {
      return {
        requestedTopic: 'Seven Diet-Abilities',
        status: 'partial',
        reason: 'Only Resume Ability, Appetite Ability, and Delay Ability are codified in the current application source.',
        fallbackMessage: 'In current app materials, Resume-Ability, Appetite Ability, and Delay Ability are documented. The complete Seven Diet-Abilities doctrine is not yet fully codified in our source material.',
      };
    }

    // 3. Specific unsupported / hypothetical diet-ability queries
    const unsupportedAbilities = ['sleep ability', 'fasting ability', 'metabolism ability', 'macro ability'];
    for (const ability of unsupportedAbilities) {
      if (lower.includes(ability)) {
        return {
          requestedTopic: ability,
          status: 'unknown',
          reason: 'This concept is not defined in any current SDA source material.',
          fallbackMessage: `I don't have enough SDA source material for "${ability}" yet. I only coach from verified Super Diet-Ability concepts.`,
        };
      }
    }

    // 4. Inquiries specifically about uncodified SDA rules or Sergio unpublished material
    if (
      lower.includes('unpublished') ||
      lower.includes('secret rule') ||
      lower.includes('ebook chapter') ||
      lower.includes('undocumented sda') ||
      lower.includes('concept that isn\'t defined') ||
      lower.includes('undefined sda')
    ) {
      return {
        requestedTopic: 'Uncodified SDA Concept',
        status: 'unknown',
        reason: 'The requested concept does not exist in the current authoritative app source.',
        fallbackMessage: "I don't have enough SDA source material for that concept yet. I stick strictly to documented Super Diet-Ability principles.",
      };
    }

    return null;
  }
}

export function createSDAKnowledgeBase(): SDAKnowledgeBase {
  return new DefaultSDAKnowledgeBase();
}

export const defaultSDAKnowledgeBase = createSDAKnowledgeBase();
