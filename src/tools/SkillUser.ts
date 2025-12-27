import { jsonToXml } from '../lib/xml';
import type { SkillRegistry } from '../types';

export function createSkillLoader(provider: SkillRegistry) {
  const registry = provider.controller;

  /**
   * Load multiple skills into the chat
   */
  async function loadSkills(skillNames: string[], onLoad: (content: string) => Promise<void>) {
    await provider.controller.ready.promise;

    const loaded: string[] = [];
    const notFound: string[] = [];

    for (const skillName of skillNames) {
      // Try to find skill by toolName first (primary key), then by name (backward compat)

      const skill = registry.get(skillName);

      if (!skill) {
        notFound.push(skillName);
        continue;
      }

      await onLoad(jsonToXml(skill, 'Skill'));
      loaded.push(skill.toolName);
    }

    return JSON.stringify({ loaded, notFound });
  }

  return loadSkills;
}
