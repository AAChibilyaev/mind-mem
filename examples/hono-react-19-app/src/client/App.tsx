'use client'

import { Suspense } from 'react'
import { Toaster } from 'sonner'
import { TodoList } from './components/TodoList'
import { Container } from '@/components/ui/container'
import { Header } from '@/components/ui/header'

/**
 * Root App component with React 19 patterns.
 * Uses Suspense for async boundaries.
 */
export default function App() {
  return (
    <>
      <Header />
      <Container className="py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">
            Hono + React 19 + shadcn
          </h1>
          <Suspense fallback={<div>Loading...</div>}>
            <TodoList />
          </Suspense>
        </div>
      </Container>
      <Toaster position="top-center" />
    </>
  )
}
