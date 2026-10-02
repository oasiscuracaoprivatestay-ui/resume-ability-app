/**
 * SDA AI Coach — Server-Side Canonical Resolvers (Phase 36A Hotfix)
 *
 * Multilingual category resolution for EN, ES, NL.
 * Pure logic, zero browser or client storage imports.
 */

import type { FoodCategoryKey } from './types.js';

/**
 * Resolves a natural-language food category name across EN, ES, NL to canonical key.
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
