import { RateLimiter } from 'sveltekit-rate-limiter/server'
import type { RateUnit } from 'sveltekit-rate-limiter/server'

export const API_RATE_PER_MINUTE = 1000

export const API_RATE_WINDOW: RateUnit = 'm'

export const api_limiter = new RateLimiter({
	IP: [API_RATE_PER_MINUTE, API_RATE_WINDOW],
	IPUA: [API_RATE_PER_MINUTE, API_RATE_WINDOW],
})
