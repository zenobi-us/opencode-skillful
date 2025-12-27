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

    console.log('Resolved skill search query:', query);
    console.log('QueryString:', queryString);

    // List all skills if query is empty or "*"
    if (
      queryString === '' ||
      queryString === '*' ||
      (query.include.length === 1 && query.include[0] === '*') ||
      (query.include.length === 0 && query.hasExclusions === false)
    ) {
      console.log('Listing all skills as no specific query terms were provided.');
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
