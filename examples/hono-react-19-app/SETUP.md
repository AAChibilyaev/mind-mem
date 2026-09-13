# Setup Guide: Hono + React 19 + shadcn/ui Integration

## Complete Setup Process

This guide walks through setting up this full-stack application from scratch with all best practices.

### Step 1: Install Dependencies

```bash
npm install
```

**Key packages:**
- `hono@^4.12.33` — Framework (current stable)
- `@hono/node-server@^2.0.0` — Node adapter (v2, check migration docs)
- `@hono/zod-validator@^0.9.0` — Zod validation middleware
- `zod@^4.0.0` — Schema validation library
- `react@^19.0.0` — UI library
- `react-dom@^19.0.0` — React DOM renderer
- `tailwindcss@^3.4.0` — Utility-first CSS
- `shadcn-ui@^0.9.0` — Component CLI

### Step 2: Set Up shadcn/ui Components

The application references these shadcn/ui components. Install them via:

```bash
npx shadcn@latest add button card checkbox badge \
  container header alert empty dropdown-menu \
  dialog sheet drawer tabs

# For form components (if adding forms later):
npx shadcn@latest add input textarea select \
  form field-group field field-label field-description
```

**Why these components?**
- `button` — Actions with variants
- `card` — Container with sections (CardHeader, CardTitle, CardContent, CardFooter)
- `checkbox` — Todo completion toggle
- `badge` — Display counts and status
- `empty` — Empty state placeholder
- `dialog`/`sheet`/`drawer` — Overlays for modals and side panels
- `form`/`field-group` — Forms following critical rules (FieldGroup + Field structure)

### Step 3: Configure Components (Critical Rules)

After adding components, verify these critical rules in `src/components/ui/*.tsx`:

#### Spacing Rules
```tsx
// ✅ CORRECT: Use gap-*
<div className="flex flex-col gap-4">

// ❌ WRONG: space-y-* (legacy)
<div className="space-y-4">

// ✅ CORRECT: Use size-* for equal dimensions
<Avatar className="size-10" />

// ❌ WRONG: w-* h-* separately
<Avatar className="w-10 h-10" />
```

#### Color Rules
```tsx
// ✅ CORRECT: Semantic tokens from Tailwind config
<div className="bg-primary text-muted-foreground">

// ❌ WRONG: Raw utility colors
<div className="bg-blue-500 text-gray-600">
```

#### Form Layout
```tsx
// ✅ CORRECT: FieldGroup + Field structure
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" />
    <FieldDescription>We'll never share your email</FieldDescription>
  </Field>
</FieldGroup>

// ❌ WRONG: div with spacing
<div className="space-y-2">
  <label>Email</label>
  <input />
</div>
```

#### Icons
```tsx
// ✅ CORRECT: data-icon attribute, no sizing classes
<Button>
  <TrashIcon data-icon="inline-start" />
  Delete
</Button>

// ❌ WRONG: Manual sizing on icon
<Button>
  <TrashIcon className="w-4 h-4 mr-2" />
  Delete
</Button>
```

#### Validation States
```tsx
// ✅ CORRECT: data-invalid on Field, aria-invalid on control
<Field data-invalid={!!error}>
  <FieldLabel>Email</FieldLabel>
  <Input aria-invalid={!!error} />
  <FieldDescription>{error}</FieldDescription>
</Field>

// ❌ WRONG: No structured validation state
<input className="border-red-500" />
```

### Step 4: Start Development

**Terminal 1: Hono Backend**
```bash
node --watch src/server.ts
# Server runs on http://localhost:3000
# API at http://localhost:3000/api
# Docs at http://localhost:3000/api/docs
```

**Terminal 2: React Frontend**
```bash
npm run dev:client
# Frontend runs on http://localhost:5173
# Proxies API requests to http://localhost:3000
```

### Step 5: Type-Safe API Integration

The application uses **zero manual types** for the API layer:

1. **Define once**: Create Zod schema in `src/types/api.ts`
   ```typescript
   export const TodoSchema = z.object({
     id: z.string().uuid(),
     title: z.string().min(1),
     completed: z.boolean(),
   })
   ```

2. **Infer types**: Let TypeScript infer from schema
   ```typescript
   export type Todo = z.infer<typeof TodoSchema>
   ```

3. **Use in server**: Validate with Zod middleware
   ```typescript
   api.post(
     '/todos',
     zValidator('json', CreateTodoSchema),
     (c) => {
       const todo = c.req.valid('json')  // type: CreateTodo
       return c.json(created, 201)
     }
   )
   ```

4. **Use in client**: RPC client infers from server type
   ```typescript
   const client = hc<AppType>('http://localhost:3000')
   const todos = await client.api.todos.$get()  // type: Todo[]
   ```

### Step 6: Environment Configuration

Create `.env.local`:
```env
VITE_API_URL=http://localhost:3000
VERSION=0.1.0
```

Access in code:
```typescript
const version = import.meta.env.VITE_VERSION
```

### Step 7: Build & Deploy

**Local production build:**
```bash
npm run build
NODE_ENV=production node dist/server.js
```

**Deployment options:**

- **Node.js**: Use `dist/server.js` with PM2 or Docker
- **Cloudflare Workers**: Replace `@hono/node-server` with `hono/cloudflare-workers`
- **Vercel**: Deploy React to Vercel, API to Vercel Functions or external
- **Railway/Render**: Deploy to container service

## Best Practices Applied

### Hono
✅ Type-safe `Bindings` and `Variables` on app constructor
✅ Middleware factory with typed composition
✅ Zod validation for all inputs
✅ Error handling with `onError` and `HTTPException`
✅ Built-in middleware (CORS, secure headers, logging)

### React 19
✅ `useTransition` for non-blocking mutations
✅ `Suspense` for async boundaries
✅ Custom hooks for data management (useTodos)
✅ No Redux/Zustand — simpler state management
✅ Server Components ready (`'use client'` directive)

### shadcn/ui
✅ Critical rules applied (FieldGroup, gap spacing, semantic colors)
✅ Icon pattern with `data-icon` attribute
✅ Accessibility defaults (aria-invalid, aria-label)
✅ No manual styling overrides
✅ Component composition (Card with sections, Button variants)

### TypeScript
✅ Strict mode enabled
✅ No `any` types — full inference
✅ Path aliases (@/, @server/, @client/, @types/)
✅ Generic constraints on functions and components

## Troubleshooting

### "Cannot find module" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Type errors on Hono routes
Ensure `Env` type includes all `Bindings` and `Variables` used:
```typescript
type Env = {
  Bindings: { /* all env vars */ }
  Variables: { /* all per-request state */ }
}
```

### shadcn/ui components not found
Run `npx shadcn@latest add <component>` to install missing components.

### API not responding from client
Check CORS configuration in `src/server/middleware.ts`:
```typescript
origin: ['http://localhost:5173', 'http://localhost:3000'],
```

## Next Steps

1. **Add authentication** — Integrate with `@hono/clerk-auth` or `@hono/oauth-providers`
2. **Add database** — Connect to PostgreSQL with Drizzle or Prisma
3. **Add OpenAPI docs** — Use `@hono/zod-openapi` for auto-generated API docs
4. **Add testing** — Unit tests with Vitest, integration tests with supertest
5. **Add monitoring** — OpenTelemetry with `@hono/otel`

## Resources

- [Hono Documentation](https://hono.dev)
- [React 19 Documentation](https://react.dev)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Zod Documentation](https://zod.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
