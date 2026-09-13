import { createFactory } from 'hono/factory'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { cache } from 'hono/cache'
import type { Env, AppContext } from '@types/env'

/**
 * Middleware factory for reusable, typed middleware.
 * Returns middleware that inherits Env type safety.
 */
const factory = createFactory<Env>()

/**
 * CORS middleware
 */
export const corsMiddleware = factory.createMiddleware(async (c, next) => {
  const corsHandler = cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
  return corsHandler(c, next)
})

/**
 * Request logging middleware
 */
export const loggerMiddleware = factory.createMiddleware(async (c, next) => {
  const handler = logger()
  return handler(c, next)
})

/**
 * Security headers middleware
 */
export const securityMiddleware = factory.createMiddleware(async (c, next) => {
  const handler = secureHeaders()
  return handler(c, next)
})

/**
 * Request initialization middleware (timing, request ID)
 */
export const requestIdMiddleware = factory.createMiddleware(async (c, next) => {
  const requestId = crypto.randomUUID()
  c.set('startTime', Date.now())
  c.set('requestId', requestId)
  c.header('X-Request-ID', requestId)
  return next()
})

/**
 * Caching middleware for GET requests
 */
export const cachingMiddleware = factory.createMiddleware(async (c, next) => {
  if (c.req.method === 'GET') {
    const cacheKey = new URL(c.req.url).pathname
    const cacheHandler = cache({
      cacheName: 'api-cache',
      wait: true,
    })
    return cacheHandler(c, next)
  }
  return next()
})

/**
 * Error handling middleware
 */
export const errorMiddleware = factory.createMiddleware(async (c, next) => {
  try {
    await next()
  } catch (error) {
    const requestId = c.get('requestId')
    const startTime = c.get('startTime')

    if (error instanceof Error) {
      console.error(`[${requestId}] Error: ${error.message}`)
    }

    // Re-throw or respond — Hono's onError handles it
    throw error
  }
})
