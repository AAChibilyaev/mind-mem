import { useState, useCallback, useEffect } from 'react'
import type { Todo, CreateTodo } from '@types/api'
import { api } from '@client/lib/api-client'

/**
 * Custom hook managing todo list state and mutations.
 * Replaces Redux/Zustand for simple request-based state.
 */
export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Load todos on mount
  useEffect(() => {
    const loadTodos = async () => {
      setLoading(true)
      setError(null)
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
      setTodos((prev) => [...prev, newTodo])
      return newTodo
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create')
      setError(error)
      throw error
    }
  }, [])

  const updateTodo = useCallback(async (id: string, data: Partial<CreateTodo>) => {
    try {
      const updated = await api.todos.update(id, data)
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? updated : t))
      )
      return updated
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update')
      setError(error)
      throw error
    }
  }, [])

  const deleteTodo = useCallback(async (id: string) => {
    try {
      await api.todos.delete(id)
      setTodos((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete')
      setError(error)
      throw error
    }
  }, [])

  return {
    todos,
    loading,
    error,
    createTodo,
    updateTodo,
    deleteTodo,
  }
}
