import { SkillRegistryController, SkillRegistryProvider as SkillProvider } from '../types';
import { createSkillSearcher } from './SkillSearcher';

export function createSkillProvider(registry: SkillRegistryController): SkillProvider {
  return {
    registry,
    searcher: createSkillSearcher(registry),
  };
}
