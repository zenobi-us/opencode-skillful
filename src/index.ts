/**
 * OpenCode Skills Plugin
 *
 * Implements Anthropic's Agent Skills Specification (v1.0) for OpenCode.
 *
 * Features:
 * - Discovers SKILL.md files from .opencode/skills/, ~/.opencode/skills/, and ~/.config/opencode/skills/
 * - Validates skills against Anthropic's spec (YAML frontmatter + Markdown)
 * - Provides unified skill discovery and loading via two main tools:
 *   - use_skills(): Load one or more skills by name
 *   - find_skills(): Search for skills by free-text query
 * - Delivers skill content via silent message insertion (noReply pattern)
 * - Supports nested skills with proper naming
 * - Supports multiple prompt formats (XML, JSON, Markdown) with model-aware selection
 *
 * Design Decisions:
 * - Consolidates 50+ individual skill tools into 2 unified tools (cleaner namespace)
 * - Skills are discovered resources, not always-on capabilities
 * - Lazy loading: skills only inject when explicitly requested
 * - Tool restrictions handled at agent level (not skill level)
 * - Message insertion pattern ensures skill content persists (user messages not purged)
 * - Base directory context enables relative path resolution
 * - Skills require restart to reload (acceptable trade-off)
 * - Prompt format selection: model-aware via modelRenderers config, default XML
 *
 * @see https://github.com/anthropics/skills
 */

import { tool, ToolContext, type Plugin } from '@opencode-ai/plugin';

import { createInstructionInjector } from './lib/OpenCodeChat';
import { createApi } from './api';
import { getPluginConfig } from './config';
import { createPromptRenderer } from './lib/createPromptRenderer';
import { getModelFormat } from './lib/getModelFormat';
import { createMessageModelIdAccountant } from './services/MessageModelIdAccountant';

export const SkillsPlugin: Plugin = async (ctx) => {
  const config = await getPluginConfig(ctx);
  const api = await createApi(config);
  const sendPrompt = createInstructionInjector(ctx);
  const promptRenderer = createPromptRenderer();
  const modelIdAccountant = createMessageModelIdAccountant();

  api.registry.initialise();

  return {
    'chat.message': async (input) => {
      if (!input.messageID || !input.model?.providerID || !input.model?.modelID) {
        return;
      }

      // Track model usage per message
      modelIdAccountant.track({
        messageID: input.messageID,
        providerID: input.model.providerID,
        modelID: input.model.modelID,
        sessionID: input.sessionID,
      });
    },
    async event(args) {
      switch (args.event.type) {
        case 'message.removed':
          modelIdAccountant.untrackMessage(args.event.properties);
          break;
        case 'session.deleted':
          modelIdAccountant.untrackSession(args.event.properties.info.id);
          break;
      }
    },
    tool: {
      skill_use: tool({
        description:
          'Load one or more skills into the chat. Provide an array of skill names to load them as user messages.',
        args: {
          skill_names: tool.schema
            .array(tool.schema.string())
            .describe('An array of skill names to load.'),
        },
        execute: async (args, toolCtx: ToolContext) => {
          const messageID = toolCtx.messageID;
          const sessionID = toolCtx.sessionID;
          const modelInfo = modelIdAccountant.getModelInfo({ messageID, sessionID });

          // Resolve the appropriate format for the current model
          const format = getModelFormat({
            modelId: modelInfo?.modelID,
            providerId: modelInfo?.providerID,
            config,
          });
          const renderer = promptRenderer.getFormatter(format);

          const results = await api.loadSkill(args.skill_names);
          for await (const skill of results.loaded) {
            await sendPrompt(renderer(skill, 'Skill'), {
              sessionId: toolCtx.sessionID,
            });
          }

          return JSON.stringify({
            loaded: results.loaded.map((skill) => skill!.toolName),
            not_found: results.notFound,
          });
        },
      }),

      skill_find: tool({
        description: `Search for skills using natural query syntax`,
        args: {
          query: tool.schema
            .union([tool.schema.string(), tool.schema.array(tool.schema.string())])
            .describe('The search query string or array of strings.'),
        },
        execute: async (args, toolCtx: ToolContext) => {
          const messageID = toolCtx.messageID;
          const sessionID = toolCtx.sessionID;
          const modelInfo = modelIdAccountant.getModelInfo({ messageID, sessionID });

          // Resolve the appropriate format for the current model
          const format = getModelFormat({
            config,
            modelId: modelInfo?.modelID,
            providerId: modelInfo?.providerID,
          });
          const renderer = promptRenderer.getFormatter(format);

          const results = await api.findSkills(args);
          const output = renderer(results, 'SkillSearchResults');
          return output;
        },
      }),

      skill_resource: tool({
        description: `Read a resource file from a skill.`,
        args: {
          skill_name: tool.schema.string().describe('The skill id to read the resource from.'),
          relative_path: tool.schema
            .string()
            .describe('The relative path to the resource file within the skill directory.'),
        },
        execute: async (args, toolCtx: ToolContext) => {
          const messageID = toolCtx.messageID;
          const sessionID = toolCtx.sessionID;
          const modelInfo = modelIdAccountant.getModelInfo({ messageID, sessionID });

          // Resolve the appropriate format for the current model
          const format = getModelFormat({
            config,
            modelId: modelInfo?.modelID,
            providerId: modelInfo?.providerID,
          });

          const renderer = promptRenderer.getFormatter(format);

          const result = await api.readResource(args);
          if (!result.injection) {
            throw new Error('Failed to read resource');
          }

          await sendPrompt(renderer(result.injection, 'Resource'), {
            sessionId: toolCtx.sessionID,
          });

          return JSON.stringify({
            result: 'Resource injected successfully',
            resource_path: result.injection.resource_path,
            resource_mimetype: result.injection.resource_mimetype,
          });
        },
      }),
    },
  };
};
