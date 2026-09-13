import { serve } from '@hono/node-server'
import { app } from './server'

const port = 3000

console.log(`🚀 Server starting on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
