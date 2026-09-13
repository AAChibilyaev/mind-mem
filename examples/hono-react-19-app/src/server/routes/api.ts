import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Env, AppContext } from '@types/env'
import { CreateTodoSchema, TodoSchema, UserSchema } from '@types/api'

/**
 * API routes with type-safe validation.
 * Schema validation → typed c.req.valid() → TypeScript infers response type.
 */
export const api = new Hono<Env>()

/**
 * GET /api/todos - List all todos
 * Returns: Todo[]
 */
api.get('/todos', (c: AppContext) => {
  // Mock data — replace with DB call
  const todos = [
    {
      id: '1',
      title: 'Learn Hono',
      description: 'Master type-safe routing',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]
  return c.json(todos, 200)
})

/**
 * POST /api/todos - Create a new todo
 * Body: CreateTodo
 * Returns: Todo
 */
api.post(
  '/todos',
  zValidator('json', CreateTodoSchema),
  (c: AppContext) => {
    const todo = c.req.valid('json')
    const created = {
      ...todo,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    return c.json(created, 201)
  }
)

/**
 * GET /api/todos/:id - Get a single todo
 * Params: { id: string }
 * Returns: Todo
 */
api.get('/todos/:id', (c: AppContext) => {
  const { id } = c.req.param()
  // Mock data
  const todo = {
    id,
    title: 'Example Todo',
    description: 'Learn Hono + React 19',
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return c.json(todo)
})

/**
 * PUT /api/todos/:id - Update a todo
 * Params: { id: string }
 * Body: Partial<CreateTodo>
 * Returns: Todo
 */
api.put(
  '/todos/:id',
  zValidator('json', CreateTodoSchema.partial()),
  (c: AppContext) => {
    const { id } = c.req.param()
    const updates = c.req.valid('json')
    return c.json({
      id,
      title: updates.title || 'Todo',
      description: updates.description,
      completed: updates.completed ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
)

/**
 * DELETE /api/todos/:id - Delete a todo
 * Params: { id: string }
 * Returns: { success: true }
 */
api.delete('/todos/:id', (c: AppContext) => {
  const { id } = c.req.param()
  return c.json({ success: true, id })
})

/**
 * GET /api/me - Get current user
 * Returns: User
 */
api.get('/me', (c: AppContext) => {
  const userId = c.get('userId')
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return c.json({
    id: userId,
    email: 'user@example.com',
    name: 'John Doe',
    createdAt: new Date(),
  })
})
