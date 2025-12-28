import type { Skill, SkillRegistry } from '../types';

export function createSkillLoader(provider: SkillRegistry) {
  const registry = provider.controller;

  /**
   * Load multiple skills into the chat
   */
  async function loadSkills(skillNames: string[]) {
    await provider.controller.ready.whenReady();

    const loaded: Skill[] = [];
    const notFound: string[] = [];

    for (const name of skillNames) {
      const skill = registry.get(name);
      if (skill) {
        loaded.push(skill);
      } else {
        notFound.push(name);
      }
    }

    return {
      loaded,
      notFound,
    };
  }

  return loadSkills;
}
