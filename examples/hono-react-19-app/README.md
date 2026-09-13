# Hono + React 19 + shadcn/ui

Type-safe full-stack application showcasing:
- **Hono 4.12.x**: End-to-end type-safe routing with zero manual type duplication
- **React 19**: Modern patterns including `useTransition`, `Suspense`, and concurrent rendering
- **shadcn/ui 4.21**: Production-ready components with critical rules applied
- **TypeScript**: Strict mode with full type inference across the stack

## Architecture

```
src/
├── server/                 # Hono backend
│   ├── index.ts          # Main app with middleware stack
│   ├── middleware.ts      # Typed middleware using factory
│   └── routes/
│       └── api.ts         # API routes with Zod validation
├── client/                 # React frontend
│   ├── App.tsx            # Root component with Suspense
│   ├── components/        # shadcn/ui components
│   ├── hooks/             # Custom React hooks
│   └── lib/
│       └── api-client.ts  # Type-safe RPC client (hc<AppType>)
└── types/
    ├── env.ts             # Bindings + Variables type
    └── api.ts             # Zod schemas + inferred types
```

## Key Patterns

### 1. Type-Safe Bindings (No Duplication)

```typescript
// src/types/env.ts — single source of truth
type Env = {
  Bindings: { VERSION: string; API_KEY?: string }
  Variables: { userId?: string; startTime: number }
}

// Use everywhere without restating:
const app = new Hono<Env>()  // inherits type safety
```

### 2. Zod Schema → Inferred Types

```typescript
// src/types/api.ts
const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  completed: z.boolean().default(false),
})
type CreateTodo = z.infer<typeof CreateTodoSchema>  // never duplicate

// src/server/routes/api.ts
api.post('/todos', zValidator('json', CreateTodoSchema), (c) => {
  const todo = c.req.valid('json')  // typed as CreateTodo
  return c.json(created, 201)
})
```

### 3. Type-Safe RPC Client

```typescript
// src/client/lib/api-client.ts
const client = hc<AppType>('http://localhost:3000')

// Type-inferred from server routes:
const todos = await client.api.todos.$get()  // typed response
const created = await client.api.todos.$post({ json: data })  // typed body
```

### 4. React 19 Patterns

- **`useTransition`** for non-blocking updates
- **`Suspense`** for async boundaries
- **Custom hooks** for data management (no Redux/Zustand needed)
- **`'use client'`** for client components

### 5. shadcn/ui Critical Rules

- **Form layout**: `FieldGroup` + `Field` (not `div`)
- **Spacing**: `gap-*` (not `space-y-*`)
- **Icons**: `data-icon` attribute
- **Validation**: `data-invalid` on Field, `aria-invalid` on control
- **Colors**: Semantic tokens (`bg-primary`, `text-muted-foreground`)

## Setup

```bash
# Install dependencies
npm install

# Start dev server (both backend + frontend)
npm run dev

# Type check
npm run type-check

# Build for production
npm run build
```

## Development

```bash
# Terminal 1: Start Hono backend
node --watch src/server.ts

# Terminal 2: Start React dev server
npm run dev:client
```

API is served at `http://localhost:3000/api`
Frontend dev server at `http://localhost:5173`

## Testing

```bash
# Run tests
npm test

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration
```

## Deployment

### Node.js Server

```bash
npm run build
NODE_ENV=production node dist/server.js
```

### Cloudflare Workers

Replace `@hono/node-server` with `hono/cloudflare-workers`.

### Vercel

Deploy frontend to Vercel, backend to Serverless Functions or external API.

## Additional Resources

- [Hono Docs](https://hono.dev) — full API reference
- [React 19 Docs](https://react.dev) — new hooks and patterns
- [shadcn/ui Docs](https://ui.shadcn.com) — component reference
- [TypeScript Handbook](https://www.typescriptlang.org/docs) — strict mode best practices
