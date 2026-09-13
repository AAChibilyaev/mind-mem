import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { serveStatic } from 'hono/serve-static'
import { apiReference } from '@scalar/hono-api-reference'
import type { Env } from '@types/env'
import { api } from './routes/api'
import {
  corsMiddleware,
  loggerMiddleware,
  securityMiddleware,
  requestIdMiddleware,
  errorMiddleware,
} from './middleware'

/**
 * Main Hono app.
 * Type-safe bindings and variables defined once on constructor.
 */
export const app = new Hono<Env>()

/**
 * Global middleware stack
 */
app.use(corsMiddleware)
app.use(loggerMiddleware)
app.use(securityMiddleware)
app.use(requestIdMiddleware)
app.use(errorMiddleware)

/**
 * API documentation with Scalar (OpenAPI)
 */
app.get(
  '/api/docs',
  apiReference({
    spec: {
      url: '/api/openapi.json',
    },
  })
)

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: c.env.VERSION,
  })
})

/**
 * Mount API routes
 */
app.route('/api', api)

/**
 * Static files (React build output)
 */
app.use('/assets/*', serveStatic({ root: './' }))
app.get('/', serveStatic({ path: './index.html' }))

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404)
})

/**
 * Global error handler
 */
app.onError((err, c) => {
  const requestId = c.get('requestId')

  if (err instanceof HTTPException) {
    // Hono HTTP exceptions
    console.error(
      `[${requestId}] HTTPException:`,
      err.status,
      err.message
    )
    return err.getResponse()
  }

  // Unexpected errors
  console.error(`[${requestId}] Unexpected error:`, err)
  return c.json(
    {
      error: 'Internal Server Error',
      requestId,
      ...(process.env.NODE_ENV === 'development' && { message: err.message }),
    },
    500
  )
})

export type AppType = typeof app
