/**
 * SDA AI Coach — Canonical Domain Resolvers (Phase 34)
 *
 * Maps natural language terms to canonical app models (food options,
 * categories, quantities, soup portions, and outcomes) across EN, ES, and NL.
 */

import {
  CANONICAL_FOOD_OPTIONS,
  type SoupPortionKey,
} from '../data/foodOptions';
import {
  FOOD_CATEGORY_KEYS,
  type FoodCategoryKey,
} from '../data/dietData';
import type {
  DetailedBlockOutcome,
} from '../utils/dietVerificationStorage';
import type {
  CheckInStatus,
} from '../utils/checkInStorage';

// ── 1. Canonical Food & Category Resolver ────────────────────────────────────

export interface ResolvedFood {
  foodKey: string;
  foodLabel: string;
  categoryKey: FoodCategoryKey;
  categoryLabel: string;
  confidence: number;
}

// Multilingual synonym / translation index for canonical items
interface FoodAlias {
  terms: string[];
  foodKey: string;
  categoryKey: FoodCategoryKey;
  label: string;
}

const FOOD_ALIASES: FoodAlias[] = [
  // Protein
  { terms: ['beef', 'carne', 'carne de res', 'vacuno', 'ternera', 'rundvlees', 'biefstuk', 'steak'], foodKey: 'beef', categoryKey: 'protein', label: 'Beef' },
  { terms: ['chicken', 'pollo', 'kip', 'pechuga de pollo', 'kippendij'], foodKey: 'chicken', categoryKey: 'protein', label: 'Chicken' },
  { terms: ['turkey', 'pavo', 'kalkoen'], foodKey: 'turkey', categoryKey: 'protein', label: 'Turkey' },
  { terms: ['pork', 'cerdo', 'varkensvlees'], foodKey: 'pork', categoryKey: 'protein', label: 'Pork' },
  { terms: ['fish', 'pescado', 'vis'], foodKey: 'fish', categoryKey: 'protein', label: 'Fish' },
  { terms: ['salmon', 'salmón', 'zalm'], foodKey: 'salmon', categoryKey: 'protein', label: 'Salmon' },
  { terms: ['tuna', 'atún', 'tonijn'], foodKey: 'tuna', categoryKey: 'protein', label: 'Tuna' },
  { terms: ['eggs', 'egg', 'huevo', 'huevos', 'ei', 'eieren'], foodKey: 'eggs', categoryKey: 'protein', label: 'Eggs' },
  { terms: ['greek yogurt', 'yogur griego', 'griekse yoghurt'], foodKey: 'greek_yogurt', categoryKey: 'protein', label: 'Greek Yogurt' },
  { terms: ['cheese', 'queso', 'kaas'], foodKey: 'cheese', categoryKey: 'protein', label: 'Cheese' },
  { terms: ['tofu'], foodKey: 'tofu', categoryKey: 'protein', label: 'Tofu' },
  { terms: ['protein shake', 'batido de proteínas', 'eiwitshake'], foodKey: 'protein_shake', categoryKey: 'protein', label: 'Protein Shake' },

  // Simple Carbs
  { terms: ['white rice', 'arroz blanco', 'witte rijst'], foodKey: 'white_rice', categoryKey: 'simple_carbs', label: 'White Rice' },
  { terms: ['white bread', 'pan blanco', 'wit brood'], foodKey: 'white_bread', categoryKey: 'simple_carbs', label: 'White Bread' },
  { terms: ['pasta', 'fideos'], foodKey: 'pasta', categoryKey: 'simple_carbs', label: 'Pasta' },
  { terms: ['crackers', 'galletas saladas'], foodKey: 'crackers', categoryKey: 'simple_carbs', label: 'Crackers' },
  { terms: ['tortilla', 'wrap'], foodKey: 'tortilla_wrap', categoryKey: 'simple_carbs', label: 'Tortilla / Wrap' },

  // Complex Carbs
  { terms: ['rice', 'arroz', 'rijst'], foodKey: 'brown_rice', categoryKey: 'complex_carbs', label: 'Rice' },
  { terms: ['brown rice', 'arroz integral', 'bruine rijst', 'zilvervliesrijst'], foodKey: 'brown_rice', categoryKey: 'complex_carbs', label: 'Brown Rice' },
  { terms: ['oats', 'oatmeal', 'avena', 'havermout'], foodKey: 'oats', categoryKey: 'complex_carbs', label: 'Oats' },
  { terms: ['quinoa'], foodKey: 'quinoa', categoryKey: 'complex_carbs', label: 'Quinoa' },
  { terms: ['potato', 'potatoes', 'patata', 'patatas', 'papa', 'papas', 'aardappel', 'aardappelen'], foodKey: 'potato', categoryKey: 'complex_carbs', label: 'Potato' },
  { terms: ['sweet potato', 'batata', 'camote', 'zoete aardappel'], foodKey: 'sweet_potato', categoryKey: 'complex_carbs', label: 'Sweet Potato' },
  { terms: ['lentils', 'lentejas', 'linzen'], foodKey: 'lentils', categoryKey: 'complex_carbs', label: 'Lentils' },

  // Vegetables
  { terms: ['broccoli', 'brócoli'], foodKey: 'broccoli', categoryKey: 'vegetables', label: 'Broccoli' },
  { terms: ['spinach', 'espinacas', 'espinaca', 'spinazie'], foodKey: 'spinach', categoryKey: 'vegetables', label: 'Spinach' },
  { terms: ['salad', 'salad greens', 'lettuce', 'ensalada', 'lechuga', 'sla'], foodKey: 'lettuce_salad_greens', categoryKey: 'vegetables', label: 'Salad' },
  { terms: ['tomato', 'tomatoes', 'tomate', 'tomates', 'tomaat', 'tomaten'], foodKey: 'tomato', categoryKey: 'vegetables', label: 'Tomato' },
  { terms: ['cucumber', 'pepino', 'komkommer'], foodKey: 'cucumber', categoryKey: 'vegetables', label: 'Cucumber' },
  { terms: ['carrot', 'carrots', 'zanahoria', 'zanahorias', 'wortel', 'wortels'], foodKey: 'carrot', categoryKey: 'vegetables', label: 'Carrot' },

  // Fruits
  { terms: ['apple', 'apples', 'manzana', 'manzanas', 'appel', 'appels'], foodKey: 'apple', categoryKey: 'fruits', label: 'Apple' },
  { terms: ['banana', 'bananas', 'plátano', 'plátanos', 'banaan', 'bananen'], foodKey: 'banana', categoryKey: 'fruits', label: 'Banana' },
  { terms: ['berries', 'berries', 'bayas', 'frutos rojos', 'bessen'], foodKey: 'berries', categoryKey: 'fruits', label: 'Berries' },

  // Soups
  { terms: ['chicken soup', 'sopa de pollo', 'kippensoep'], foodKey: 'chicken_soup', categoryKey: 'soups', label: 'Chicken Soup' },
  { terms: ['tomato soup', 'sopa de tomate', 'tomatensoep'], foodKey: 'tomato_soup', categoryKey: 'soups', label: 'Tomato Soup' },
  { terms: ['vegetable soup', 'sopa de verduras', 'groentesoep'], foodKey: 'vegetable_soup', categoryKey: 'soups', label: 'Vegetable Soup' },
  { terms: ['lentil soup', 'sopa de lentejas', 'linzensoep'], foodKey: 'lentil_soup', categoryKey: 'soups', label: 'Lentil Soup' },
  { terms: ['soup', 'sopa', 'soep'], foodKey: 'other_soup', categoryKey: 'soups', label: 'Soup' },
];

const CATEGORY_DISPLAY_NAMES: Record<FoodCategoryKey, string> = {
  protein: 'Protein',
  simple_carbs: 'Simple Carbs',
  complex_carbs: 'Complex Carbs',
  healthy_fats: 'Healthy Fats',
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  desserts: 'Desserts',
  snacks: 'Snacks',
  beverages: 'Beverages',
  soups: 'Soups',
};

/**
 * Resolves a food phrase into a canonical food option and parent category.
 * If term is unknown, returns null (never invents a category).
 */
export function resolveFoodTerm(term: string): ResolvedFood | null {
  const clean = term.trim().toLowerCase();
  if (!clean) return null;

  // 1. Direct match in aliases table
  for (const alias of FOOD_ALIASES) {
    for (const t of alias.terms) {
      if (t === clean) {
        return {
          foodKey: alias.foodKey,
          foodLabel: alias.label,
          categoryKey: alias.categoryKey,
          categoryLabel: CATEGORY_DISPLAY_NAMES[alias.categoryKey],
          confidence: 0.95,
        };
      }
    }
  }

  // 2. Substring/contains match in aliases table
  for (const alias of FOOD_ALIASES) {
    for (const t of alias.terms) {
      if (clean.includes(t)) {
        return {
          foodKey: alias.foodKey,
          foodLabel: alias.label,
          categoryKey: alias.categoryKey,
          categoryLabel: CATEGORY_DISPLAY_NAMES[alias.categoryKey],
          confidence: 0.85,
        };
      }
    }
  }

  // 3. Match against canonical options definition
  for (const cat of FOOD_CATEGORY_KEYS) {
    const list = CANONICAL_FOOD_OPTIONS[cat] || [];
    for (const opt of list) {
      const optNormalized = opt.key.replace(/_/g, ' ').toLowerCase();
      if (opt.key === clean || optNormalized === clean || clean.includes(optNormalized)) {
        const label = opt.key.charAt(0).toUpperCase() + opt.key.slice(1).replace(/_/g, ' ');
        return {
          foodKey: opt.key,
          foodLabel: label,
          categoryKey: cat,
          categoryLabel: CATEGORY_DISPLAY_NAMES[cat],
          confidence: 0.85,
        };
      }
    }
  }

  return null;
}

/**
 * Resolves a category name across EN, ES, NL.
 */
export function resolveCategoryTerm(term: string): FoodCategoryKey | null {
  const clean = term.trim().toLowerCase();
  if (!clean) return null;

  if (/protein|prote[ií]na|eiwit|meat|carne|vlees/i.test(clean)) return 'protein';
  if (/simple\s*carb|carbohidrato\s*simple|snelle\s*koolhydra/i.test(clean)) return 'simple_carbs';
  if (/complex\s*carb|carbohidrato\s*complejo|langzame\s*koolhydra/i.test(clean)) return 'complex_carbs';
  if (/fat|grasa|vet/i.test(clean)) return 'healthy_fats';
  if (/vegetable|verdura|vegetal|groente/i.test(clean)) return 'vegetables';
  if (/fruit|fruta/i.test(clean)) return 'fruits';
  if (/dessert|postre|toetje/i.test(clean)) return 'desserts';
  if (/snack|merienda|tussendoor/i.test(clean)) return 'snacks';
  if (/beverage|drink|bebida|drank/i.test(clean)) return 'beverages';
  if (/soup|sopa|soep/i.test(clean)) return 'soups';

  return null;
}

// ── 2. Quantity & Unit Resolvers ─────────────────────────────────────────────

export interface ResolvedQuantity {
  amount?: number;
  unit?: string;
  portionCount?: number;
  freeText?: string;
}

/**
 * Parses and resolves quantity text.
 * Distinguishes explicit portion counts from physical metrics (grams, ml, etc.).
 */
export function resolveQuantity(text: string): ResolvedQuantity | null {
  const clean = text.trim().toLowerCase();
  if (!clean) return null;

  // 1. Explicit portion count: e.g. "4 portions", "4 porties", "4 porciones", "4 portion"
  const portionMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:portion|portions|portie|porties|porci[oó]n|porciones)\b/i);
  if (portionMatch) {
    const num = parseFloat(portionMatch[1]);
    return {
      amount: num,
      unit: 'portion',
      portionCount: num,
    };
  }

  // 2. Grams: e.g. "250 g", "250 grams", "250 gramos", "250 grammen"
  const gramMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams|gramo|gramos|grammen)\b/i);
  if (gramMatch) {
    const num = parseFloat(gramMatch[1]);
    return {
      amount: num,
      unit: 'gram',
      // Notice: NO portionCount set! 250 g must NOT become 250 portions.
    };
  }

  // 3. Milliliters: e.g. "300 ml", "300 milliliters"
  const mlMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:ml|milliliter|milliliters|mililitro|mililitros)\b/i);
  if (mlMatch) {
    const num = parseFloat(mlMatch[1]);
    return {
      amount: num,
      unit: 'ml',
      // Notice: NO portionCount set! 300 ml must NOT become 300 portions.
    };
  }

  // 4. Pieces: e.g. "2 pieces", "2 piezas", "2 stuks"
  const pieceMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:piece|pieces|pieza|piezas|stuk|stuks|stukken)\b/i);
  if (pieceMatch) {
    const num = parseFloat(pieceMatch[1]);
    return {
      amount: num,
      unit: 'piece',
    };
  }

  // 5. Cups: e.g. "1 cup", "2 tazas", "2 koppen"
  const cupMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:cup|cups|taza|tazas|kop|koppen)\b/i);
  if (cupMatch) {
    const num = parseFloat(cupMatch[1]);
    return {
      amount: num,
      unit: 'cup',
    };
  }

  // 6. Slices: e.g. "2 slices", "2 rebanadas", "2 plakjes"
  const sliceMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:slice|slices|rebanada|rebanadas|plak|plakjes)\b/i);
  if (sliceMatch) {
    const num = parseFloat(sliceMatch[1]);
    return {
      amount: num,
      unit: 'slice',
    };
  }

  // 7. Capsules / supplements: e.g. "2 capsules", "2 cápsulas"
  const capsuleMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:capsule|capsules|c[aá]psula|c[aá]psulas|pill|pills|pastilla|pastillas)\b/i);
  if (capsuleMatch) {
    const num = parseFloat(capsuleMatch[1]);
    return {
      amount: num,
      unit: 'capsules',
    };
  }

  return null;
}

// ── 3. Soup Portion Resolver ─────────────────────────────────────────────────

/**
 * Resolves descriptive soup portion size (small, medium, large, xlarge).
 * Never converts large into a number of portions.
 */
export function resolveSoupPortion(text: string): SoupPortionKey | null {
  const clean = text.trim().toLowerCase();
  if (!clean) return null;

  if (/\b(?:xlarge|x-large|extra\s*large|extra\s*grande|extra\s*groot)\b/i.test(clean)) return 'xlarge';
  if (/\b(?:large|grande|groot)\b/i.test(clean)) return 'large';
  if (/\b(?:medium|mediana|mediano|gemiddeld)\b/i.test(clean)) return 'medium';
  if (/\b(?:small|peque[ñn]a|peque[ñn]o|klein)\b/i.test(clean)) return 'small';

  return null;
}

// ── 4. Outcome Resolver (DetailedBlockOutcome) ───────────────────────────────

export interface ResolvedOutcome {
  outcome: DetailedBlockOutcome;
  isSlip: boolean;
  resumed?: boolean;
  resumeDurationMinutes?: number;
}

/**
 * Resolves outcomes respecting the core rules:
 * - 20% OFF TRACK is NOT a slip.
 * - Near-Slip is NOT a crossed-boundary slip and does not imply resumed.
 * - Structured Slip & Unstructured Slip can independently track resumed.
 */
export function resolveOutcome(text: string): ResolvedOutcome | null {
  const clean = text.trim().toLowerCase();
  if (!clean) return null;

  // 1. 20% OFF TRACK
  if (/20%|20\s*percent|veinte\s*por\s*ciento|20\s*procent/i.test(clean) && /off\s*track|fuera|buiten/i.test(clean)) {
    return {
      outcome: 'twenty_percent_off_track',
      isSlip: false,
    };
  }

  // 2. Near-Slip (stopped before crossing boundary)
  if (/near[-\s]?slip|almost\s*slipped|casi\s*me\s*deslizo|casi\s*un\s*desliz|bijna\s*uitgegleden|stopped\s*myself|me\s*detuve/i.test(clean)) {
    return {
      outcome: 'near_slip',
      isSlip: true, // Grouped under slip outcomes taxonomy in verification storage, but distinct
      resumed: false, // Does NOT imply resumed
    };
  }

  // 3. Structured Slip
  if (/structured\s*slip|desliz\s*estructurado|gestructureerde\s*uitglijder/i.test(clean)) {
    const resumeInfo = parseResumeDetails(clean);
    return {
      outcome: 'structured_slip',
      isSlip: true,
      resumed: resumeInfo.resumed,
      resumeDurationMinutes: resumeInfo.durationMinutes,
    };
  }

  // 4. Unstructured Slip
  if (/unstructured\s*slip|desliz\s*no\s*estructurado|ongestructureerde\s*uitglijder|lost\s*my\s*structure|completely\s*lost|perd[ií]\s*toda\s*la\s*estructura|geen\s*structuur/i.test(clean)) {
    const resumeInfo = parseResumeDetails(clean);
    return {
      outcome: 'unstructured_slip',
      isSlip: true,
      resumed: resumeInfo.resumed,
      resumeDurationMinutes: resumeInfo.durationMinutes,
    };
  }

  // 5. Planned Unstructured
  if (/planned\s*unstructured|no\s*estructurado\s*planeado|gepland\s*ongestructureerd/i.test(clean)) {
    return {
      outcome: 'planned_unstructured',
      isSlip: false,
    };
  }

  // 6. Adjusted and On Track
  if (/adjusted\s*and\s*on\s*track|ajustado\s*y\s*en\s*estructura|aangepast\s*op\s*schema/i.test(clean)) {
    return {
      outcome: 'adjusted_on_track',
      isSlip: false,
    };
  }

  // 7. On Track
  if (/on\s*track|on\s*structure|en\s*estructura|op\s*schema/i.test(clean)) {
    return {
      outcome: 'on_track',
      isSlip: false,
    };
  }

  return null;
}

/**
 * Extracts resume state and optional duration from slip language.
 * E.g. "resumed after 20 minutes" -> { resumed: true, durationMinutes: 20 }
 */
export function parseResumeDetails(text: string): { resumed: boolean; durationMinutes?: number } {
  const matchWithDuration = text.match(/(?:resumed|retom[eé]|hervat|got back)\s*(?:after|despu[eé]s\s*de|na)?\s*(\d+)\s*(?:min|minutes|minutos|minuten)\b/i);
  if (matchWithDuration) {
    return {
      resumed: true,
      durationMinutes: parseInt(matchWithDuration[1], 10),
    };
  }

  if (/\b(?:resumed|retom[eé]|hervat|back\s*on\s*track|back\s*on\s*structure)\b/i.test(text)) {
    return {
      resumed: true,
    };
  }

  return {
    resumed: false,
  };
}

// ── 5. Check-In Status Resolver ──────────────────────────────────────────────

export function resolveCheckInStatus(text: string): CheckInStatus | null {
  const clean = text.trim().toLowerCase();
  if (!clean) return null;

  if (/\b(?:on structure|on-structure|on track|en estructura|op schema)\b/i.test(clean)) {
    return 'on-structure';
  }
  if (/\b(?:near slip|near-slip|close to slipping|cerca de deslizar|bijna uitglijden)\b/i.test(clean)) {
    return 'near-slip';
  }
  if (/\b(?:slipped|i slipped|deslic[eé]|uitgegleden)\b/i.test(clean)) {
    return 'slip';
  }

  return null;
}
