# Mind-Mem Integration: Hono + React 19 + shadcn/ui

This document outlines how this full-stack application integrates with the **mind-mem** persistent memory system and how to leverage memory tools for:

1. **Project documentation** — Storing architectural decisions and patterns
2. **Type-safe knowledge graph** — Mapping Hono routes and React components
3. **Audit chain** — Tracking all schema changes and API evolution
4. **Intelligent recall** — Fast retrieval of patterns and examples

## Architecture

```
mind-mem (persistent memory)
├── Project Kernel
│   ├── Type System (Bindings, Variables, Schemas)
│   ├── API Surface (routes, middleware, error handling)
│   └── Component Registry (shadcn/ui usage patterns)
├── Pattern Library
│   ├── Hono: Middleware factory, validation, error handling
│   ├── React 19: useTransition, Suspense, custom hooks
│   └── shadcn/ui: Critical rules, form patterns, accessibility
├── Audit Chain
│   ├── Schema evolution (Zod schemas)
│   ├── Route additions/removals
│   └── Component integration tracking
└── Knowledge Graph
    ├── Predicates: hasRoute, usesComponent, validatedBy
    ├── Entities: Endpoints, Components, Types
    └── Relationships: Type → Validator → Route
```

## Memory Tools Usage

### 1. Document Architectural Patterns

Store key patterns in memory for future reference:

```bash
# Use @mem to recall Hono patterns
@mem/recall "type-safe bindings hono"
# Returns: Env type structure, middleware factory pattern, validation flow

@mem/recall "react 19 useTransition async pattern"
# Returns: Examples of startTransition with mutations, error handling

@mem/recall "shadcn critical rules spacing icons"
# Returns: gap-* spacing, data-icon patterns, accessibility requirements
```

### 2. Propose Schema Updates

When adding new routes or API endpoints:

```bash
@mem/propose_update
# Operation: Add new POST /api/projects endpoint
# Schema: ProjectSchema with validation rules
# Audit: Include reason, date, author context
```

### 3. Verify Type Consistency

Query the memory system to ensure types stay in sync:

```bash
@mem/verify_chain
# Check: All routes match their Zod schemas
# Check: React components use correct API client methods
# Check: shadcn components follow critical rules
```

### 4. Retrieve Component Patterns

Fast lookup of proven patterns:

```bash
@mem/hybrid_search "form validation error handling"
# BM25: Keyword match for "error handling"
# Vector: Semantic similarity for validation patterns
# Returns: Ranked list of validation implementations
```

## Knowledge Graph Structure

### Entities

```typescript
interface Route {
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  schema: {
    input?: string  // Zod schema name
    output?: string // Response type
    middleware: string[]
  }
  handler: string // Function name
  tags: string[] // OpenAPI tags
}

interface Component {
  name: string
  category: "form" | "layout" | "feedback" | "overlay"
  rules: string[] // Critical rules applied
  dependencies: string[] // Other components
  variants: string[] // Props/variants
}

interface APISchema {
  name: string
  type: "input" | "output" | "error"
  fields: Record<string, string>
  validations: string[]
  lifecycle: string[] // v1, v2, deprecated
}
```

### Predicates

```typescript
// Route relationships
hasRoute(endpoint: string, method: string, path: string)
useMiddleware(route: string, middleware: string)
validatedBy(route: string, schema: string)
returns(route: string, type: string)

// Component relationships
implements(component: string, rule: string)
dependsOn(component: string, otherComponent: string)
usesShadcnBase(component: string, baseComponent: string)

// Type relationships
inherits(type: string, baseType: string)
evolvedFrom(schema: string, priorSchema: string)
validatedWith(input: string, validator: string)
```

## Recording Memory

### When Creating a New Route

```typescript
// 1. Create Zod schema in src/types/api.ts
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  createdAt: z.date(),
})

// 2. Record in memory:
@mem/propose_update
{
  "operation": "add_route",
  "route": {
    "method": "POST",
    "path": "/api/projects",
    "input_schema": "ProjectSchema",
    "output_schema": "Project",
    "middleware": ["authentication", "validation"]
  },
  "reason": "Enable project creation workflow",
  "audit": {
    "timestamp": "2026-09-13T...",
    "author": "Claude Haiku 4.5",
    "breaking_change": false
  }
}
```

### When Adding a Component

```typescript
// 1. Install via shadcn CLI
npx shadcn@latest add dialog

// 2. Record in memory:
@mem/propose_update
{
  "operation": "add_component",
  "component": {
    "name": "Dialog",
    "category": "overlay",
    "rules_applied": [
      "DialogTitle required for accessibility",
      "Use sr-only for hidden titles",
      "Portal to prevent z-index issues"
    ],
    "usage_example": "DeleteConfirmationDialog"
  }
}
```

### When Adding a React Hook

```typescript
// 1. Create hook in src/client/hooks/
export function useProjects() {
  // Implementation
}

// 2. Record in memory:
@mem/propose_update
{
  "operation": "add_hook",
  "hook": {
    "name": "useProjects",
    "purpose": "Fetch and manage projects list",
    "api_methods": ["list", "create", "update", "delete"],
    "state": ["projects", "loading", "error"],
    "pattern": "Custom hook + API client"
  }
}
```

## Intelligent Retrieval Examples

### Finding Similar Patterns

```bash
# Query: How do we handle async operations in this codebase?
@mem/hybrid_search "async mutation loading state"

# Returns patterns from:
# - useTodos hook implementation
# - useTransition in TodoList component
# - API client error handling
# With ranked relevance and code references
```

### Checking Type Conformance

```bash
# Query: What types does the /api/todos/:id endpoint expect?
@mem/recall "todos endpoint validation schema"

# Returns:
# - CreateTodoSchema (input)
# - TodoSchema (output)
# - Zod validation rules
# - Usage examples in components
```

### Auditing Changes

```bash
# Query: When did we last change the Todo schema?
@mem/list_evidence
# Filter: "TodoSchema" predicate

# Returns:
# - Schema evolution history
# - Why changes were made
# - Date and author
# - Affected routes and components
```

## Best Practices

### 1. Single Source of Truth

❌ **Avoid**: Duplicating types in multiple files
```typescript
// Bad: Type defined in both api.ts and component
type Todo = { id: string; title: string }
```

✅ **Better**: Define once, import everywhere
```typescript
// src/types/api.ts
export type Todo = z.infer<typeof TodoSchema>

// src/client/components/TodoList.tsx
import type { Todo } from '@types/api'
```

### 2. Document Rationale

When recording memory, always include **why** not just **what**:

```
// ✅ Good
{
  "reason": "Support partial updates without breaking existing clients",
  "breaking_change": false,
  "migration_path": "Both PUT and PATCH accepted until v2"
}

// ❌ Poor
{
  "reason": "Update endpoint"
}
```

### 3. Link Related Decisions

Use predicates to create decision graphs:

```
schema(TodoSchema)
  ├── validatedBy(zValidator)
  ├── usedIn(POST /api/todos)
  └── referencedBy(TodoList component)
      └── dependsOn(useTodos hook)
          └── uses(api.todos.update)
```

### 4. Version Schemas

When APIs evolve, track versions:

```typescript
// src/types/api.ts
export const TodoSchemaV1 = z.object({
  id: z.string(),
  title: z.string(),
})

export const TodoSchemaV2 = z.object({
  id: z.string().uuid(), // Added strict UUID validation
  title: z.string().min(1),
  priority?: "low" | "medium" | "high", // New field
})

// Record in memory the evolution:
// TodoSchemaV1 -> TodoSchemaV2 (backward compatible)
```

## Integration Workflow

### 1. New Feature Development

```bash
# Step 1: Recall patterns
@mem/recall "form handling pattern"

# Step 2: Create types/schemas
# - Define in src/types/api.ts
# - Use Zod for validation

# Step 3: Create route
# - Implement in src/server/routes/api.ts
# - Use middleware factory

# Step 4: Record in memory
@mem/propose_update "Add new endpoint with schema"

# Step 5: Create React component
# - Use shadcn/ui following critical rules
# - Call custom hook that uses API client

# Step 6: Approve memory update
@mem/approve_apply "Record confirmed"
```

### 2. Bug Fix Audit Trail

```bash
# Step 1: Find related memory
@mem/list_contradictions  # Find inconsistencies
@mem/verify_chain         # Check type consistency

# Step 2: Document fix
@mem/propose_update "Fix bug in TodoSchema validation"

# Step 3: Record evidence
@mem/list_evidence "TodoSchema bug fix"
```

### 3. Refactoring with Confidence

```bash
# Step 1: Export current state
@mem/export_memory "Pre-refactor snapshot"

# Step 2: Search for impact
@mem/traverse_graph "TodoSchema" # Find all usage

# Step 3: After refactoring
@mem/verify_chain # Confirm nothing broke

# Step 4: Record rationale
@mem/propose_update "Refactored TodoSchema for clarity"
```

## Memory Schema Reference

All memory records follow this structure:

```json
{
  "type": "architectural_decision | pattern | schema_evolution | audit_event",
  "timestamp": "ISO 8601",
  "author": "Claude Haiku 4.5",
  "component": "hono | react | shadcn | types",
  "subject": "route | component | hook | schema",
  "content": {
    "description": "What changed and why",
    "before": "Prior state (if applicable)",
    "after": "New state",
    "impact": "Affected modules"
  },
  "metadata": {
    "breaking_change": false,
    "migration_required": false,
    "links": ["related_decision_id"]
  }
}
```

## Examples

### Recording Hono Middleware Pattern

```bash
@mem/propose_update
{
  "type": "pattern",
  "component": "hono",
  "subject": "middleware",
  "content": {
    "description": "Typed middleware factory pattern for composition",
    "pattern": {
      "name": "createFactory<Env>",
      "benefit": "Type-safe middleware composition",
      "example": "corsMiddleware, securityMiddleware"
    },
    "usage": "All Hono middleware uses this pattern"
  }
}
```

### Recording React 19 Hook Pattern

```bash
@mem/propose_update
{
  "type": "pattern",
  "component": "react",
  "subject": "hook",
  "content": {
    "description": "useTodos hook with useTransition integration",
    "pattern": {
      "name": "useTransition + custom hook",
      "benefit": "Non-blocking UI updates",
      "example": "TodoList component handles optimistic updates"
    }
  }
}
```

## Proposal Batch (ready to replay)

Everything this example teaches is already distilled into
`mind-mem/proposals.hono-react-shadcn.json` — 38 `decision` + 2 `task`
proposals in the exact argument shape of the `propose_update` MCP tool
(owner rule, TypeScript, Hono 4.12, React 19, shadcn/ui 4.21, SaaS
architecture, testing/git/deploy, PR #5 facts, mind-mem workflow).

`propose_update` is **admin-scoped** (`src/mind_mem/mcp/infra/acl.py`),
so the `mem` MCP connector must run with `MIND_MEM_SCOPE=admin` — in
user scope every write tool returns `requires admin scope` and the
whole recall → propose → approve loop degrades to read-only. Once the
scope is set, replay the batch through the same tool (merge `defaults`
into each entry), or through the gRPC/HTTP API where operation
`"propose"` maps to `governance.propose_update`. Each replay still goes
through the provenance policy, quality gate, v4 field validation and
the governance admission gate, lands in `intelligence/SIGNALS.md` as
`[SIG-YYYYMMDD-###]`, and becomes active only after `approve_apply`.

## Summary

The mind-mem integration provides:

1. **Persistence** — All patterns, decisions, and schemas survive across sessions
2. **Queryability** — Fast retrieval via BM25 + vector search
3. **Auditability** — Complete chain of changes with rationale
4. **Type Safety** — Knowledge graph ensures consistency across components
5. **Intelligence** — Context from past decisions informs new development

By treating the codebase as a queryable knowledge base, we reduce debugging time, prevent regressions, and accelerate feature development.
