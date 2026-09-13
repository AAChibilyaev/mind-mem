'use client'

import { useTransition } from 'react'
import type { Todo } from '@types/api'
import { useTodos } from '@client/hooks/useTodos'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Trash2Icon } from 'lucide-react'

/**
 * Todo list component using shadcn/ui and React 19.
 * Uses useTransition for non-blocking UI updates.
 */
export function TodoList() {
  const { todos, loading, createTodo, updateTodo, deleteTodo } = useTodos()
  const [isPending, startTransition] = useTransition()

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading todos...</p>
        </CardContent>
      </Card>
    )
  }

  const handleToggle = (todo: Todo) => {
    startTransition(async () => {
      await updateTodo(todo.id, { completed: !todo.completed })
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteTodo(id)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Todos</span>
          <Badge variant="secondary">
            {todos.filter((t) => !t.completed).length} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {todos.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No todos yet. Create one to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => handleToggle(todo)}
                  disabled={isPending}
                  aria-label={`Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'complete'}`}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium truncate ${
                      todo.completed ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {todo.title}
                  </p>
                  {todo.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {todo.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(todo.id)}
                  disabled={isPending}
                  aria-label={`Delete "${todo.title}"`}
                >
                  <Trash2Icon data-icon="inline-start" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
