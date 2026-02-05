---
id: codemap01
title: OpenCode Skillful Codebase Map
created_at: 2026-02-05
updated_at: 2026-02-05
area: codebase-structure
tags:
  - architecture
  - codebase-map
learned_from:
  - initial analysis
---

# Codebase Codemap

## State Machine Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPENCODE SKILLFUL PLUGIN                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐      ┌─────────────────┐      ┌──────────────────────────────┐
│   STARTUP   │─────▶│   INITIALIZE    │─────▶│        READY STATE           │
│             │      │                 │      │                              │
│ index.ts    │      │ • getConfig     │      │ Listening for tool calls:    │
│ Plugin()    │      │ • createApi     │      │ • skill_use                  │
└─────────────┘      │ • registry.init │      │ • skill_find                 │
                     └─────────────────┘      │ • skill_resource             │
                                              └──────────────────────────────┘
                                                           │
                     ┌─────────────────────────────────────┼─────────────────┐
                     ▼                                     ▼                 ▼
            ┌────────────────┐               ┌────────────────┐    ┌─────────────────┐
            │  skill_find    │               │   skill_use    │    │ skill_resource  │
            │                │               │                │    │                 │
            │ Query parsing  │               │ Load skills    │    │ Read skill file │
            │ Skill search   │               │ Inject prompts │    │ Return content  │
            │ Return results │               │ Track model    │    │                 │
            └────────────────┘               └────────────────┘    └─────────────────┘
                     │                                │                      │
                     └────────────────┬───────────────┴──────────────────────┘
                                      ▼
                          ┌─────────────────────┐
                          │   PromptRenderer    │
                          │                     │
                          │ Format selection:   │
                          │ • XML (default)     │
                          │ • JSON              │
                          │ • Markdown          │
                          └─────────────────────┘
```

## Module Architecture

```
src/
├── index.ts                 # Plugin entry point, tool definitions
├── api.ts                   # Factory - wires components together
├── config.ts                # Plugin configuration loading
├── types.ts                 # Type definitions
│
├── services/
│   ├── SkillRegistry.ts     # Core: skill discovery, parsing, storage
│   ├── SkillSearcher.ts     # Query parsing & skill matching
│   ├── SkillResourceResolver.ts  # Resolve resource paths
│   ├── MessageModelIdAccountant.ts  # Track model per message
│   └── logger.ts            # Debug logging
│
├── tools/
│   ├── SkillFinder.ts       # skill_find tool creator
│   ├── SkillUser.ts         # skill_use tool creator
│   └── SkillResourceReader.ts  # skill_resource tool creator
│
└── lib/
    ├── SkillFs.ts           # Filesystem operations
    ├── OpenCodeChat.ts      # Message injection
    ├── Identifiers.ts       # ID generation utilities
    ├── getModelFormat.ts    # Model-aware format selection
    ├── createPromptRenderer.ts  # Renderer factory
    ├── xml.ts               # XML utilities
    └── renderers/
        ├── XmlPromptRenderer.ts   # XML format
        ├── JsonPromptRenderer.ts  # JSON format
        └── MdPromptRenderer.ts    # Markdown format
```

## Data Flow

```
┌─────────────────┐
│ Tool Invocation │
│ (skill_use)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ ModelAccountant │────▶│ Get Model Info  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ SkillRegistry   │────▶│ Lookup Skill    │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ PromptRenderer  │────▶│ Format Content  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ OpenCodeChat    │
│ (inject prompt) │
└─────────────────┘
```

## Key Types

```
Skill {
  toolName: string      # Unique identifier (path-based)
  name: string          # Display name from frontmatter
  description: string   # From frontmatter
  content: string       # Markdown content
  skillPath: string     # Absolute path to SKILL.md
  basePath: string      # Base directory for resolution
  scripts: Map          # Available scripts
  assets: Map           # Available assets
  references: Map       # Reference files
}

SkillRegistry {
  initialise()          # Discover and parse all skills
  find(query)           # Search skills
  get(toolName)         # Get single skill
  skills: Skill[]       # All registered skills
}
```
