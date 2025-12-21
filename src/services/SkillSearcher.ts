import SearchString from 'search-string';
import type { Skill, ParsedSkillQuery, TextSegment, SkillRank, SkillSearchResult } from '../types';

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

export class SkillSearcher {
  private skills: Skill[];

  constructor(skills: Skill[]) {
    this.skills = skills;
  }

  /**
   * Parse a user query into structured search terms
   */
  private parseQuery(queryString: string): ParsedSkillQuery {
    const searchStringInstance = SearchString.parse(queryString);

    const textSegments = searchStringInstance.getTextSegments() as TextSegment[];
    const include = textSegments
      .filter((s: TextSegment) => !s.negated)
      .map((s: TextSegment) => s.text.toLowerCase())
      .filter((s: string) => s.length > 0);

    const exclude = textSegments
      .filter((s: TextSegment) => s.negated)
      .map((s: TextSegment) => s.text.toLowerCase())
      .filter((s: string) => s.length > 0);

    return {
      include,
      exclude,
      originalQuery: queryString,
      hasExclusions: exclude.length > 0,
      termCount: textSegments.length,
    };
  }

  /**
   * Calculate ranking score for a skill against query terms
   */
  private rankSkill(skill: Skill, includeTerms: string[]): SkillRank {
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
  private shouldIncludeSkill(skill: Skill, excludeTerms: string[]): boolean {
    if (excludeTerms.length === 0) {
      return true;
    }

    const haystack = `${skill.name} ${skill.description}`.toLowerCase();
    return !excludeTerms.some((term) => haystack.includes(term));
  }

  /**
   * Generate user-friendly feedback about query interpretation
   */
  private generateFeedback(query: ParsedSkillQuery, matchCount: number): string {
    const parts: string[] = [];

    if (query.include.length > 0) {
      parts.push(`📝 Searching for: **${query.include.join(', ')}**`);
    }

    if (query.hasExclusions) {
      parts.push(`🚫 Excluding: **${query.exclude.join(', ')}**`);
    }

    if (matchCount === 0) {
      parts.push(`❌ No matches found`);
    } else if (matchCount === 1) {
      parts.push(`✅ Found 1 match`);
    } else {
      parts.push(`✅ Found ${matchCount} matches`);
    }

    return parts.join(' | ');
  }

  /**
   * Execute a search query and return ranked results
   */
  public search(queryString: string): SkillSearchResult {
    const query = this.parseQuery(queryString);

    if (query.include.length === 0) {
      return {
        matches: [],
        totalMatches: 0,
        feedback: this.generateFeedback(query, 0),
        query,
      };
    }

    let results = this.skills.filter((skill) => {
      const haystack = `${skill.name} ${skill.description}`.toLowerCase();
      return query.include.every((term) => haystack.includes(term));
    });

    const totalMatches = results.length;

    results = results.filter((skill) => this.shouldIncludeSkill(skill, query.exclude));

    const ranked: SkillRank[] = results
      .map((skill) => this.rankSkill(skill, query.include))
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
    const feedback = this.generateFeedback(query, matches.length);

    return {
      matches,
      totalMatches,
      feedback,
      query,
    };
  }
}
