---
id: dataflow1
title: Data Flow Diagram
created_at: 2026-02-05
updated_at: 2026-02-05
area: data-flow
tags:
  - architecture
  - data-flow
learned_from:
  - initial analysis
---

# Data Flow

## Plugin Initialization Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           INITIALIZATION                                  │
└──────────────────────────────────────────────────────────────────────────┘

     ┌─────────┐
     │ OpenCode│
     │  Host   │
     └────┬────┘
          │ loads plugin
          ▼
     ┌─────────┐      ┌──────────┐
     │ index.ts│─────▶│ config.ts│
     │ Plugin()│      │          │
     └────┬────┘      └────┬─────┘
          │                │
          │                ▼
          │         ┌──────────────┐
          │         │PluginConfig  │
          │         │ • basePaths  │
          │         │ • debug      │
          │         │ • renderers  │
          │         └──────┬───────┘
          │                │
          ▼                ▼
     ┌─────────┐      ┌──────────────┐
     │ api.ts  │◀─────│ createApi()  │
     │         │      └──────────────┘
     └────┬────┘
          │ creates
          ▼
     ┌──────────────────────────────────────────┐
     │              API Object                   │
     │  ┌─────────────┐  ┌─────────────────┐    │
     │  │Logger       │  │SkillRegistry    │    │
     │  └─────────────┘  │  (not init yet) │    │
     │                   └─────────────────┘    │
     │  ┌─────────────┐  ┌─────────────────┐    │
     │  │findSkills() │  │loadSkill()      │    │
     │  └─────────────┘  └─────────────────┘    │
     │  ┌─────────────────────────────────┐     │
     │  │readResource()                   │     │
     │  └─────────────────────────────────┘     │
     └──────────────────────────────────────────┘
          │
          │ registry.initialise()
          ▼
     ┌─────────────────────────────────────┐
     │         SKILL DISCOVERY              │
     │                                      │
     │  For each basePath:                  │
     │    └─▶ findSkillPaths()             │
     │         └─▶ register()              │
     │              └─▶ parseSkill()       │
     │                   └─▶ store.set()   │
     └─────────────────────────────────────┘
```

## Tool Execution Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        SKILL_USE TOOL FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

  User Request                    Tool Context
       │                              │
       ▼                              ▼
  ┌─────────┐                   ┌───────────┐
  │skill_use│                   │ messageID │
  │  args   │                   │ sessionID │
  └────┬────┘                   └─────┬─────┘
       │                              │
       ▼                              ▼
  ┌──────────────────────────────────────────┐
  │        MessageModelIdAccountant           │
  │  getModelInfo({messageID, sessionID})    │
  └─────────────────────┬────────────────────┘
                        │
                        ▼
  ┌──────────────────────────────────────────┐
  │           getModelFormat()               │
  │  • Check config.modelRenderers           │
  │  • Match provider:model pattern          │
  │  • Return: 'xml' | 'json' | 'md'         │
  └─────────────────────┬────────────────────┘
                        │
                        ▼
  ┌──────────────────────────────────────────┐
  │         api.loadSkill(names)             │
  │  • For each skill name:                  │
  │    └─▶ registry.get(name)               │
  └─────────────────────┬────────────────────┘
                        │
                        ▼
  ┌──────────────────────────────────────────┐
  │         promptRenderer.getFormatter()    │
  │  • Select renderer by format             │
  │  • XmlPromptRenderer                     │
  │  • JsonPromptRenderer                    │
  │  • MdPromptRenderer                      │
  └─────────────────────┬────────────────────┘
                        │
                        ▼
  ┌──────────────────────────────────────────┐
  │           renderer({data, type})         │
  │  • Format skill content                  │
  │  • Add metadata                          │
  └─────────────────────┬────────────────────┘
                        │
                        ▼
  ┌──────────────────────────────────────────┐
  │         sendPrompt(content, {sessionId}) │
  │  • Inject as user message                │
  │  • Persists in chat                      │
  └──────────────────────────────────────────┘
```

## Search Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      SKILL_FIND SEARCH FLOW                               │
└──────────────────────────────────────────────────────────────────────────┘

  Query String
       │
       ▼
  ┌─────────────────────┐
  │   parseQuery()      │
  │                     │
  │ "react -test"       │
  │         │           │
  │         ▼           │
  │ ┌─────────────────┐ │
  │ │ include: [react]│ │
  │ │ exclude: [test] │ │
  │ └─────────────────┘ │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ For each skill:     │
  │                     │
  │ shouldIncludeSkill()│◀─── exclude filter
  │         │           │
  │         ▼           │
  │   rankSkill()       │◀─── scoring:
  │   • name match: 3x  │     name > description
  │   • desc match: 1x  │
  │   • exact bonus     │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │  Sort by score      │
  │  Return top matches │
  └─────────────────────┘
```
