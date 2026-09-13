# Complete Best Practices Catalog
## Hono + React 19 + shadcn/ui Full-Stack

**Version**: 1.0.0  
**Last Updated**: 2026-09-13  
**Status**: Living Document (updated as agents complete research)

---

## Table of Contents
1. [TypeScript Strict Rules](#typescript-strict-rules)
2. [Hono Patterns & Anti-patterns](#hono-patterns--anti-patterns)
3. [React 19 Patterns & Anti-patterns](#react-19-patterns--anti-patterns)
4. [shadcn/ui Critical Rules](#shadcnui-critical-rules)
5. [SaaS Architecture Patterns](#saas-architecture-patterns)
6. [Deployment & Operations](#deployment--operations)
7. [Memory Integration Guide](#memory-integration-guide)

---

## TypeScript Strict Rules

### Rule 1: No `any` Type
```typescript
// ❌ NEVER
const data: any = fetchData()

// ✅ CORRECT
const data: unknown = fetchData()
if (typeof data === 'object' && data !== null) {
  // narrowed type
}

// ✅ BETTER: With proper typing
interface Data {
  id: string
  name: string
}
const data: Data = await api.fetchData()
```

### Rule 2: Infer Types from Schemas
```typescript
// ❌ NEVER: Duplicate type definitions
type Todo = { id: string; title: string }
const TodoSchema = z.object({ id: z.string(), title: z.string() })

// ✅ CORRECT: Single source of truth
const TodoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
})
type Todo = z.infer<typeof TodoSchema>
```

### Rule 3: Use Strict Generics
```typescript
// ❌ GENERIC TOO LOOSE
function createHandler<T>(data: T) {
  return { data }
}

// ✅ CONSTRAINED GENERIC
interface HasId {
  id: string
}
function createEntity<T extends HasId>(data: T): T {
  return { ...data }
}
```

### Rule 4: Path Aliases for Imports
```typescript
// File: tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@server/*": ["./src/server/*"],
      "@client/*": ["./src/client/*"],
      "@types/*": ["./src/types/*"]
    }
  }
}

// Usage: No relative paths
import type { Todo } from '@types/api'  // ✅
import { useTodos } from '@client/hooks/useTodos'  // ✅
```

---

## Hono Patterns & Anti-patterns

### Pattern 1: Type-Safe Bindings & Variables (CRITICAL)

```typescript
// ❌ ANTI-PATTERN: No types
const app = new Hono()
app.get('/', c => {
  const version = c.env.VERSION  // any type!
  const userId = c.get('userId')  // any type!
})

// ✅ CORRECT: Define types once
type Env = {
  Bindings: {
    VERSION: string
    API_KEY?: string
    DB: D1Database
  }
  Variables: {
    userId?: string
    startTime: number
    requestId: string
  }
}

const app = new Hono<Env>()
app.use(async (c, next) => {
  c.set('startTime', Date.now())
  c.set('requestId', crypto.randomUUID())
  await next()
})

app.get('/', c => {
  const version = c.env.VERSION  // type: string ✅
  const userId = c.get('userId')  // type: string | undefined ✅
  const startTime = c.get('startTime')  // type: number ✅
})
```

### Pattern 2: Middleware Factory for Composition

```typescript
// ❌ ANTI-PATTERN: Middleware without types
app.use(cors({ origin: '*' }))  // Generic middleware
app.use(async (c, next) => { /* no types */ })  // Inline middleware

// ✅ CORRECT: Type-safe factory
import { createFactory } from 'hono/factory'

const factory = createFactory<Env>()

const corsMiddleware = factory.createMiddleware(async (c, next) => {
  return cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })(c, next)
})

const authMiddleware = factory.createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const userId = verifyToken(token)
  c.set('userId', userId)
  return next()
})

app.use(corsMiddleware)
app.use(authMiddleware)
```

### Pattern 3: Zod Validation with Zero Type Duplication

```typescript
// Single schema → everywhere
const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200).describe('Todo title'),
  description: z.string().optional().describe('Optional details'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
})
type CreateTodo = z.infer<typeof CreateTodoSchema>

// Server validates request
app.post(
  '/todos',
  zValidator('json', CreateTodoSchema),
  c => {
    const todo = c.req.valid('json')  // type: CreateTodo
    return c.json(created, 201)
  }
)

// Client uses same type
const response = await client.api.todos.$post({
  json: data  // type: CreateTodo (type-checked!)
})
```

### Pattern 4: Built-in Middleware (No Велосипед)

```typescript
// ❌ ANTI-PATTERN: Custom CORS
app.use(async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*')
  // ... manual CORS headers
})

// ✅ CORRECT: Use hono/cors
import { cors } from 'hono/cors'
app.use(cors({ origin: ['http://localhost:5173'] }))

// Other built-in middleware
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { cache } from 'hono/cache'
import { compress } from 'hono/compress'
import { jwt } from 'hono/jwt'

app.use(logger())
app.use(secureHeaders())
app.use(cache({ cacheName: 'api' }))
app.use(compress())
app.use(jwt({ secret: c.env.JWT_SECRET }))
```

### Pattern 5: Error Handling

```typescript
// ❌ ANTI-PATTERN: Throwing raw errors
app.post('/todos', (c) => {
  throw new Error('Something went wrong')
})

// ✅ CORRECT: Use HTTPException + onError handler
import { HTTPException } from 'hono/http-exception'

app.post('/todos', async (c) => {
  try {
    const data = c.req.valid('json')
    return c.json(created, 201)
  } catch (error) {
    throw new HTTPException(400, {
      message: 'Invalid todo data',
      cause: error,
    })
  }
})

app.onError((err, c) => {
  const requestId = c.get('requestId')
  console.error(`[${requestId}]`, err)

  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  return c.json(
    {
      error: 'Internal Server Error',
      requestId,
      ...(process.env.NODE_ENV === 'development' && {
        message: err.message,
      }),
    },
    500
  )
})
```

### Pattern 6: RPC Client for Type-Safe Calls

```typescript
// ✅ CORRECT: RPC client from server type
export type AppType = typeof app  // Export app type

// Client side
import { hc } from 'hono/client'
import type { AppType } from '@server'

const client = hc<AppType>('http://localhost:3000')

// All routes typed and type-checked!
const todos = await client.api.todos.$get()  // GET /api/todos
const created = await client.api.todos.$post({ json: data })  // POST /api/todos
const updated = await client.api.todos[':id'].$put({  // PUT /api/todos/:id
  param: { id: '123' },
  json: { title: 'Updated' }
})
```

---

## React 19 Patterns & Anti-patterns

### Pattern 1: useTransition for Non-Blocking Updates

```typescript
// ❌ ANTI-PATTERN: No loading state, blocks UI
export function TodoList() {
  const [todos, setTodos] = useState([])

  async function addTodo(title: string) {
    const created = await api.todos.create({ title })
    setTodos(prev => [...prev, created])  // Blocks UI!
  }

  return <button onClick={() => addTodo('Learn React 19')}>Add</button>
}

// ✅ CORRECT: useTransition keeps UI responsive
export function TodoList() {
  const [todos, setTodos] = useState([])
  const [isPending, startTransition] = useTransition()

  function handleAdd(title: string) {
    startTransition(async () => {
      const created = await api.todos.create({ title })
      setTodos(prev => [...prev, created])
    })
  }

  return (
    <button onClick={() => handleAdd('Learn React 19')} disabled={isPending}>
      {isPending ? 'Adding...' : 'Add Todo'}
    </button>
  )
}
```

### Pattern 2: Custom Hooks for Data Management

```typescript
// ✅ CORRECT: Custom hook replaces Redux/Zustand
export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const loadTodos = async () => {
      setLoading(true)
      try {
        const data = await api.todos.list()
        setTodos(data)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setLoading(false)
      }
    }

    loadTodos()
  }, [])

  const createTodo = useCallback(async (data: CreateTodo) => {
    try {
      const newTodo = await api.todos.create(data)
      setTodos(prev => [...prev, newTodo])
      return newTodo
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create'))
      throw err
    }
  }, [])

  return { todos, loading, error, createTodo }
}

// Usage: No Redux, Context, or Zustand needed
function App() {
  const { todos, loading, createTodo } = useTodos()
  // ...
}
```

### Pattern 3: Suspense for Async Boundaries

```typescript
// ✅ CORRECT: Suspense catches async operations
async function TodoList() {
  const todos = await api.todos.list()
  return (
    <ul>
      {todos.map(todo => <li key={todo.id}>{todo.title}</li>)}
    </ul>
  )
}

export function App() {
  return (
    <Suspense fallback={<div>Loading todos...</div>}>
      <TodoList />
    </Suspense>
  )
}
```

### Pattern 4: No Inline Components

```typescript
// ❌ ANTI-PATTERN: Component defined inside function
export function App() {
  const Card = ({ children }) => <div>{children}</div>
  // Component recreated on every render!

  return <Card>Content</Card>
}

// ✅ CORRECT: Extract to module scope
const Card = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
)

export function App() {
  return <Card>Content</Card>
}
```

### Pattern 5: Type-Safe Hooks

```typescript
// ✅ CORRECT: Fully typed hook
export function useAsync<T, E = string>(
  asyncFunction: () => Promise<T>,
  immediate = true
): {
  data: T | null
  loading: boolean
  error: E | null
} {
  const [state, setState] = useState({
    data: null as T | null,
    loading: immediate,
    error: null as E | null,
  })

  useEffect(() => {
    ;(async () => {
      try {
        const response = await asyncFunction()
        setState({ data: response, loading: false, error: null })
      } catch (err) {
        setState({ data: null, loading: false, error: err as E })
      }
    })()
  }, [asyncFunction])

  return state
}
```

---

## shadcn/ui Critical Rules

### Rule 1: Form Layout with FieldGroup + Field

```typescript
// ❌ ANTI-PATTERN: div with spacing
<div className="space-y-4">
  <label>Email</label>
  <input type="email" />
</div>

// ✅ CORRECT: FieldGroup + Field composition
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" type="email" />
    <FieldDescription>We'll never share your email</FieldDescription>
  </Field>
</FieldGroup>
```

### Rule 2: Spacing with gap-* (Not space-y-/space-x-*)

```typescript
// ❌ ANTI-PATTERN: space-y-*
<div className="space-y-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// ✅ CORRECT: flex with gap-*
<div className="flex flex-col gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

### Rule 3: Semantic Colors (Not Raw Utilities)

```typescript
// ❌ ANTI-PATTERN: Raw colors
<div className="bg-blue-500 text-red-600">

// ✅ CORRECT: Semantic tokens from theme
<div className="bg-primary text-destructive">
```

### Rule 4: Icon Pattern with data-icon

```typescript
// ❌ ANTI-PATTERN: Manual sizing on icon
<Button>
  <TrashIcon className="w-4 h-4 mr-2" />
  Delete
</Button>

// ✅ CORRECT: data-icon attribute
<Button>
  <TrashIcon data-icon="inline-start" />
  Delete
</Button>
```

### Rule 5: Validation State (data-invalid + aria-invalid)

```typescript
// ❌ ANTI-PATTERN: No structured validation
<input className={error ? 'border-red-500' : ''} />

// ✅ CORRECT: data-invalid on Field, aria-invalid on control
<Field data-invalid={!!error}>
  <FieldLabel>Email</FieldLabel>
  <Input aria-invalid={!!error} />
  <FieldDescription>{error}</FieldDescription>
</Field>
```

---

## SaaS Architecture Patterns

### Multi-Tenancy

```typescript
type Env = {
  Bindings: {
    DB: D1Database
    TENANT_ID: string  // From subdomain or header
  }
  Variables: {
    tenantId: string
    userId: string
  }
}

// Middleware ensures data isolation
app.use(async (c, next) => {
  const tenantId = c.env.TENANT_ID
  c.set('tenantId', tenantId)
  await next()
})

// All queries scoped to tenant
app.get('/todos', async c => {
  const tenantId = c.get('tenantId')
  const todos = await db.query(
    'SELECT * FROM todos WHERE tenant_id = ?',
    [tenantId]
  )
  return c.json(todos)
})
```

### API Rate Limiting

```typescript
import { RateLimiter } from 'hono/rate-limiter'

const limiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // limit each IP to 100 requests per windowMs
})

app.use(limiter)
```

### Audit Logging

```typescript
app.use(async (c, next) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  const userId = c.get('userId')
  const method = c.req.method
  const path = c.req.path

  await next()

  const duration = Date.now() - startTime
  const status = c.res.status

  // Log to audit trail
  await auditLog.create({
    requestId,
    userId,
    method,
    path,
    status,
    duration,
  })
})
```

### API Versioning

```typescript
// Routes versioned from the start
app.route('/api/v1', apiV1)
app.route('/api/v2', apiV2)

// In v2, mark v1 routes as deprecated
app.get('/api/v1/todos', deprecationWarning('v1', 'v2'), (c) => {
  c.header('Deprecation', 'true')
  c.header('Sunset', 'Sat, 31 Dec 2026 23:59:59 GMT')
  // ...
})
```

---

## Deployment & Operations

### Environment Variables

```typescript
// .env.local
VERSION=1.0.0
API_URL=http://localhost:3000
DATABASE_URL=postgresql://...
JWT_SECRET=...

// src/server/index.ts
const version = c.env.VERSION
const dbUrl = c.env.DATABASE_URL
// All typed in Bindings!
```

### Health Checks

```typescript
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: c.env.VERSION,
    checks: {
      database: 'ok',
      cache: 'ok',
    },
  })
})
```

### Graceful Shutdown

```typescript
const server = serve({
  fetch: app.fetch,
  port: 3000,
})

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  // Close DB connections
  // Drain in-flight requests
  process.exit(0)
})
```

---

## Memory Integration Guide

### Recording Patterns in @mem

Every significant pattern should be recorded for future retrieval:

```typescript
// After implementing a pattern, record it:
@mem/propose_update {
  "type": "pattern",
  "component": "hono",
  "subject": "middleware-factory",
  "content": {
    "name": "Typed middleware factory with composition",
    "benefit": "Type-safe middleware reuse and composition",
    "example": "corsMiddleware, authMiddleware",
    "file": "src/server/middleware.ts"
  }
}

// Approve after review:
@mem/approve_apply
```

### Querying Patterns from Memory

```bash
# Find all Hono patterns
@mem/recall "hono type-safe bindings middleware"

# Find React 19 patterns
@mem/recall "react useTransition custom hooks"

# Find shadcn/ui rules
@mem/recall "shadcn field validation accessibility"
```

---

## Strict Rules Checklist

### TypeScript
- [ ] No `any` types — use `unknown` with type guards
- [ ] Infer types from schemas (Zod)
- [ ] Use generics with constraints
- [ ] Enable `strict: true` in tsconfig
- [ ] Path aliases configured

### Hono
- [ ] Env types defined once (Bindings + Variables)
- [ ] Middleware from `hono/*` modules
- [ ] Zod validation on all inputs
- [ ] HTTPException for error handling
- [ ] onError handler for errors
- [ ] No custom велосипеда

### React 19
- [ ] useTransition for async operations
- [ ] Suspense for async boundaries
- [ ] Custom hooks for state (no Redux/Zustand)
- [ ] No inline component definitions
- [ ] Type-safe hooks with generics
- [ ] 'use client' for client components

### shadcn/ui
- [ ] FieldGroup + Field for forms
- [ ] gap-* for spacing (not space-y/space-x)
- [ ] Semantic colors (not raw utilities)
- [ ] data-icon on icons (no size classes)
- [ ] data-invalid + aria-invalid for validation
- [ ] Full Card composition with sections

---

## Next Steps

1. **Review** this catalog with the team
2. **Add** to @mem via `propose_update`
3. **Use** for all new code — reference when coding
4. **Update** as new patterns emerge
5. **Audit** existing code against these rules
