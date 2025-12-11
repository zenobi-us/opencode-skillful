# OpenCode Skills Plugin

An interpretation of the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills) for OpenCode, providing lazy-loaded skill discovery and injection.

Differenator is : 

- Conversationally the agent uses `skill_find words, words words` to discover skills
- The agent uses `skill_use fully_resolved_skill_name` and,
- The agent can use `skill_resource skill_relative/resource/path` to read reference material

## Installation

Create or edit your OpenCode configuration file (typically `~/.config/opencode/config.json`):

```json
{
  "plugins": ["@zenobius/opencode-skillful"]
}
```

## Usage

### Example 1: Finding and Loading Skills

```
I need to write a commit message. Can you find any relevant skills and load them?

1. Use skill_find to search for "commit" or "git" related skills
2. Load the most relevant skill using skill_use
3. Apply the loaded skill guidance to write my commit message
```

**Demonstrates:**

- Searching for skills by keyword
- Loading skills into the chat context
- Applying skill guidance to tasks

### Example 2: Browsing Available Skills

```
What skills are available? Show me everything under the "experts" category.

1. List all skills with skill_find "*"
2. Filter to a specific path with skill_find "experts"
3. Load a specific expert skill for deep guidance
```

**Demonstrates:**

- Listing all available skills
- Path prefix filtering (e.g., "experts", "superpowers/writing")
- Hierarchical skill organization

### Example 3: Advanced Search with Exclusions

```
Find testing-related skills but exclude anything about performance testing.

skill_find "testing -performance"
```

**Demonstrates:**

- Natural language query syntax
- Negation with `-term`
- AND logic for multiple terms

## Features

- :mag: Discover SKILL.md files from multiple locations
- :zap: Lazy loading - skills only inject when explicitly requested
- :file_folder: Path prefix matching for organized skill browsing
- :abc: Natural query syntax with negation and quoted phrases
- :label: Skill ranking by relevance (name matches weighted higher)
- :recycle: Silent message insertion (noReply pattern)

## Skill Discovery Paths

Skills are discovered from these locations (in priority order, last wins on duplicates):

1. `~/.opencode/skills/` - User global skills (lowest priority)
2. `~/.config/opencode/skills/` - Standard XDG config location
3. `.opencode/skills/` - Project-local skills (highest priority)

## Usage in OpenCode

### Finding Skills

```
# List all available skills
skill_find
  query="*"

# Search by keyword
skill_find
  query="git commit"

# Path prefix matching
skill_find
  query="experts/data-ai"

# Exclude terms
skill_find
  query="testing -performance"
```

### Loading Skills

```
# Load a single skill
skill_use
  skill_names=["writing-git-commits"]

# Load multiple skills
skill_use
  skill_names=["writing-git-commits", "code-review"]
```

### Reading Skill Resources

```
# Read a resource file from a skill's directory
skill_resource
  skill_name="brand-guidelines"
  relative_path="templates/logo-usage.md"
```

## Plugin Tools

### `skill_find`

Search for skills using natural query syntax.

- `query`: Search string supporting:
  - `*` or empty: List all skills
  - Path prefixes: `experts`, `superpowers/writing`
  - Keywords: `git commit`
  - Negation: `-term`
  - Quoted phrases: `"exact match"`

### `skill_use`

Load one or more skills into the chat context.

- `skill_names`: Array of skill names to load (by toolName or short name)

### `skill_resource`

Read a resource file from a skill's directory.

- `skill_name`: The skill containing the resource
- `relative_path`: Path to the resource relative to the skill directory

## Creating Skills

Skills follow the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills). Each skill is a directory containing a `SKILL.md` file:

```
skills/
  my-skill/
    SKILL.md
    resources/
      template.md
```

### SKILL.md Format

```yaml
---
name: my-skill
description: A brief description of what this skill does (min 20 chars)
license: MIT
allowed-tools:
  - bash
  - read
metadata:
  author: Your Name
---
# My Skill

Instructions for the AI agent when this skill is loaded...
```

**Requirements:**

- `name` must match the directory name (lowercase, alphanumeric, hyphens only)
- `description` must be at least 20 characters
- Directory name and frontmatter `name` must match exactly

## Considerations

- Skills are discovered at plugin initialization (requires restart to reload)
- Duplicate skill names are logged and skipped (last path wins)
- Tool restrictions in `allowed-tools` are informational (enforced at agent level)
- Skill content is injected as user messages (persists in conversation)
- Base directory context is provided for relative path resolution in skills

## Contributing

Contributions are welcome! Please file issues or submit pull requests on the GitHub repository.

## License

MIT License. See the [LICENSE](LICENSE) file for details.
