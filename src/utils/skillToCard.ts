/**
 * skillToCard — adapt the various "skill" shapes used in the creator flow and
 * dashboard into the canonical `data/skillsData` Skill that <CandyCard> renders.
 *
 * The marketplace card (CandyCard) is the single source of truth for skill
 * presentation (DESIGN.md §5). User-created skills (from the skill-creator
 * `Skill` type) and dashboard listings carry a broader category union
 * (Knowledge / Analysis / Custom …) and may omit `repo` / `skillMdUrl`, so we
 * normalise them here. `getShell()` already falls back gracefully for any
 * unknown category string, so we keep the original category label on the card
 * and only satisfy the structural type.
 */

import type { Skill as StoreSkill, SkillCategory as StoreCategory } from '../data/skillsData';

/** Minimal structural shape shared by the skill-creator Skill and storage skills. */
export interface CardSkillInput {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  tags?: string[];
  popularity?: number;
  developer?: string;
  repo?: string;
  rating?: number;
  price?: number;
  executionModel?: string;
}

/**
 * Build a CandyCard-ready Skill from a looser creator/dashboard skill object.
 * Preserves the human category label (the chip shows it verbatim) while
 * satisfying the narrow StoreCategory type via a safe cast.
 */
export function skillToCard(input: CardSkillInput): StoreSkill {
  return {
    id: input.id,
    name: input.name || 'Untitled skill',
    description: input.description || '',
    category: (input.category || 'Tools') as StoreCategory,
    icon: input.icon || '✨',
    color: '',
    installCommand: '',
    tags: input.tags ?? [],
    popularity: input.popularity ?? 0,
    repo: input.repo ?? '',
    skillMdUrl: '',
    config: {},
    developer: input.developer,
    rating: input.rating,
    price: input.price,
    executionModel: input.executionModel as StoreSkill['executionModel'],
  };
}
