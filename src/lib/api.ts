// Tiny typed fetch wrapper for the JSON API. Throws ApiError with the server's message.
export class ApiError extends Error {
	status: number
	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

/**
 * `keepalive` lets the request outlive the page: use it for writes triggered right before a
 * navigation (e.g. marking a notification read on link click). Without it, a full-page
 * navigation drops the connection and the server may be cut off before it finishes.
 */
export async function api<T>(
	path: string,
	init: { method?: string; body?: unknown; keepalive?: boolean } = {},
): Promise<T> {
	const response = await fetch(path, {
		method: init.method ?? 'GET',
		keepalive: init.keepalive,
		headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
		body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
	})
	if (!response.ok) {
		let message = response.statusText || 'Request failed'
		try {
			const payload = (await response.json()) as { message?: string }
			if (payload.message) message = payload.message
		} catch {
			// non-JSON error body
		}
		throw new ApiError(response.status, message)
	}
	if (response.status === 204) return undefined as T
	return (await response.json()) as T
}
