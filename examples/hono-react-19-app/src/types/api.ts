import { z } from 'zod'

/**
 * Shared API schemas using Zod.
 * Types are inferred downstream — never duplicate them.
 */

export const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  completed: z.boolean().default(false),
})

export type CreateTodo = z.infer<typeof CreateTodoSchema>

export const TodoSchema = CreateTodoSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Todo = z.infer<typeof TodoSchema>

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.date(),
})

export type User = z.infer<typeof UserSchema>
