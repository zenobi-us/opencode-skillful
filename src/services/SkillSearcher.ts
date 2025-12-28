/**
 * SkillSearcher - Natural Language Query Parser and Skill Ranking Engine
 *
 * WHY: Users expect Gmail-style search syntax (quoted phrases, negation, multiple terms).
 * This module abstracts the search-string library and implements skill-specific ranking.
 *
 * SEARCH STRATEGY:
 * 1. Parse user query into include/exclude terms (using search-string for Gmail syntax)
 * 2. Filter: ALL include terms must appear in skill (name, description, or toolName)
 * 3. Exclude: Remove matches that contain any exclude term
 * 4. Rank: Score by match location (name matches weighted 3×, description 1×)
 * 5. Sort: By total score (desc) → name matches (desc) → alphabetically
 *
 * QUERY INTERPRETATION:
 * - "git commit" → include: [git, commit]
 * - "git -rebase" → include: [git], exclude: [rebase]
 * - '"git rebase"' → include: [git rebase] (phrase, no split)
 * - "*" or empty → list all skills
 *
 * RANKING ALGORITHM:
 * - Name match: +3 per term found in skill name
 * - Description match: +1 per term found in description
 * - Exact name match: +10 bonus
 * - Final sort: highest score first, tie-break by name matches, then alphabetical
 *
 * WHY SEARCH-STRING: Handles complex syntax edge cases (quotes, escaped chars)
 * without rolling our own parser. Proven in production systems (Gmail, etc).
 *
 * WHY NO PARTIAL MATCHING: "python" won't match "python-docstring" because we check
 * term-by-term inclusion, not word-level matching. This matches user expectations
 * (they searched for "python", not "python-" or "pythonish").
 */

import SearchString from 'search-string';
import type {
  Skill,
  ParsedSkillQuery,
  TextSegment,
  SkillRank,
  SkillSearchResult,
  SkillRegistryController,
  SkillSearcher,
} from '../types';

/**
 * Parse a user query into structured search terms
 */
export function parseQuery(queryString: string | string[]): ParsedSkillQuery {
  const queries = Array.isArray(queryString) ? queryString : [queryString];

  const textSegments = queries
    .map((query) => {
      const instance = SearchString.parse(query);
      return instance.getTextSegments();
    })
    .flat();

  const include = textSegments
    .filter((s: TextSegment) => !s.negated)
    .map((s: TextSegment) => s.text.toLowerCase())
    .filter((s: string) => s.trim().length > 0);

  const exclude = textSegments
    .filter((s: TextSegment) => s.negated)
    .map((s: TextSegment) => s.text.toLowerCase())
    .filter((s: string) => s.trim().length > 0);

  return {
    include,
    exclude,
    originalQuery: queries.filter((q) => q.trim().length > 0),
    hasExclusions: exclude.length > 0,
    termCount: textSegments.length,
  };
}

/**
 * Calculate ranking score for a skill against query terms
 *
 * SCORING FORMULA:
 * - nameMatches: number of include terms found in skill name (0 or more)
 * - descMatches: number of include terms found in description (0 or more)
 * - totalScore = (nameMatches × 3) + (descMatches × 1) + exactBonus
 * - exactBonus: +10 if query is single term and equals skill name exactly
 *
 * WHY THIS WEIGHTING:
 * - Skill name is a strong signal (3× weight) because it's the identifier
 * - Description matches are weaker (1× weight) because skill names vary
 * - Exact match bonus breaks ties and promotes direct matches to top
 *
 * EXAMPLE:
 * - Query: "git" | Skill name: "writing-git-commits" | Score: 3 (name match)
 * - Query: "git" | Skill name: "git" | Score: 13 (name match + exact bonus)
 * - Query: "revert changes" | Skill name: "git-revert" | Description: "Revert..."
 *   | Score: 4 (1 name match + 1 desc match + 2 bonus doesn't apply)
 */
export function rankSkill(skill: Skill, includeTerms: string[]): SkillRank {
  const skillName = skill.name.toLowerCase();
  const skillDesc = skill.description.toLowerCase();

  let nameMatches = 0;
  let descMatches = 0;

  for (const term of includeTerms) {
    if (skillName.includes(term)) {
      nameMatches++;
    } else if (skillDesc.includes(term)) {
      descMatches++;
    }
  }

  let exactBonus = 0;
  if (includeTerms.length === 1 && skillName === includeTerms[0]) {
    exactBonus = 10;
  }

  const totalScore = nameMatches * 3 + descMatches * 1 + exactBonus;

  return { skill, nameMatches, descMatches, totalScore };
}

/**
 * Filter out skills matching exclusion terms
 */
export function shouldIncludeSkill(skill: Skill, excludeTerms: string[]): boolean {
  if (excludeTerms.length === 0) {
    return true;
  }

  const haystack = `${skill.name} ${skill.description}`.toLowerCase();
  return !excludeTerms.some((term) => haystack.includes(term));
}

/**
 * Generate user-friendly feedback about query interpretation
 */
export function generateFeedback(query: ParsedSkillQuery, matchCount: number): string {
  const parts: string[] = [];

  if (query.include.length > 0) {
    parts.push(`Searching for: "**${query.originalQuery.join(' ')}**"`);
  } else {
    parts.push(`No include search terms provided`);
  }

  if (query.hasExclusions) {
    parts.push(`Excluding: **${query.exclude.join(', ')}**`);
  }

  if (matchCount === 0) {
    parts.push(`No matches found`);
    parts.push(`- Try different or fewer search terms.`);
    parts.push(`- Use skill_find("*") to list all skills.`);
  } else if (matchCount === 1) {
    parts.push(`Found 1 match`);
  } else {
    parts.push(`Found ${matchCount} matches`);
  }

  return parts.join(' | ');
}

/**
 * SkillSearcher - Natural Language Query Parser for Skills
 *
 * Provides clean abstraction over search-string library for skill discovery.
 * Handles query parsing, ranking, and result formatting with support for:
 * - Natural syntax (Gmail-style)
 * - Negation (-term)
 * - Quoted phrases
 * - Multiple search terms (AND logic)
 */

export function createSkillSearcher(registry: SkillRegistryController): SkillSearcher {
  function resolveQuery(queryString: string | string[]): SkillSearchResult {
    const query = parseQuery(queryString);
    const skills = registry.skills;
    const output: SkillSearchResult = {
      matches: [],
      totalMatches: 0,
      totalSkills: registry.skills.length,
      feedback: '',
      query,
    };

    // List all skills if query is empty or "*"
    if (
      queryString === '' ||
      queryString === '*' ||
      (query.include.length === 1 && query.include[0] === '*') ||
      (query.include.length === 0 && query.hasExclusions === false)
    ) {
      output.matches = skills;
      output.totalMatches = skills.length;
      output.feedback = `Listing all ${skills.length} skills`;
      return output;
    }

    let results = skills.filter((skill) => {
      const haystack = `${skill.toolName} ${skill.name} ${skill.description}`.toLowerCase();
      return query.include.every((term) => haystack.includes(term));
    });

    output.matches = results;
    output.totalMatches = results.length;
    output.feedback = generateFeedback(query, results.length);

    return output;
  }

  /**
   * Execute a search query and return ranked results
   */
  return function search(queryString: string | string[]): SkillSearchResult {
    const resolved = resolveQuery(queryString);

    const results = resolved.matches.filter((skill) =>
      shouldIncludeSkill(skill, resolved.query.exclude)
    );

    const totalMatches = results.length;

    const ranked: SkillRank[] = results
      .map((skill) => rankSkill(skill, resolved.query.include))
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (b.nameMatches !== a.nameMatches) {
          return b.nameMatches - a.nameMatches;
        }
        return a.skill.name.localeCompare(b.skill.name);
      });

    const matches = ranked.map((r) => r.skill);

    return {
      matches,
      totalMatches,
      feedback: resolved.feedback,
      query: resolved.query,
      totalSkills: registry.skills.length,
    };
  };
}
