import type { Context } from 'hono'

/**
 * Type-safe environment bindings and request variables.
 * All types flow from this single source — no duplication.
 */
export type Env = {
  Bindings: {
    /** API version for feature flags and deprecation tracking */
    VERSION: string
    /** Optional: external API keys, DB connections, secrets */
    API_KEY?: string
  }
  Variables: {
    /** Authenticated user ID from JWT or session */
    userId?: string
    /** Request timing for observability */
    startTime: number
    /** Request-scoped logger instance */
    requestId: string
  }
}

export type AppContext = Context<Env>
