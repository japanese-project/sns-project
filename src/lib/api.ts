// Tiny typed fetch wrapper for the JSON API. Throws ApiError with the server's message.
export class ApiError extends Error {
	status: number
	constructor(status: number, message: string) {
		super(message)
		this.status = status
	}
}

export async function api<T>(
	path: string,
	init: { method?: string; body?: unknown } = {},
): Promise<T> {
	const response = await fetch(path, {
		method: init.method ?? 'GET',
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
