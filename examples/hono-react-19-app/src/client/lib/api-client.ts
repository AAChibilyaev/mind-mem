import { hc } from 'hono/client'
import type { AppType } from '@server'
import type { Todo, User, CreateTodo } from '@types/api'

/**
 * Type-safe RPC client.
 * Inferred from server routes — zero manual type duplication.
 */
export const client = hc<AppType>('http://localhost:3000')

/**
 * Typed API methods wrapping the Hono client.
 * These are convenience wrappers maintaining full type safety.
 */
export const api = {
  todos: {
    async list(): Promise<Todo[]> {
      const res = await client.api.todos.$get()
      return res.json()
    },

    async get(id: string): Promise<Todo> {
      const res = await client.api.todos[':id'].$get({ param: { id } })
      return res.json()
    },

    async create(data: CreateTodo): Promise<Todo> {
      const res = await client.api.todos.$post({ json: data })
      return res.json()
    },

    async update(id: string, data: Partial<CreateTodo>): Promise<Todo> {
      const res = await client.api.todos[':id'].$put({
        param: { id },
        json: data,
      })
      return res.json()
    },

    async delete(id: string): Promise<{ success: boolean; id: string }> {
      const res = await client.api.todos[':id'].$delete({ param: { id } })
      return res.json()
    },
  },

  user: {
    async me(): Promise<User> {
      const res = await client.api.me.$get()
      if (!res.ok) throw new Error('Unauthorized')
      return res.json()
    },
  },
}
