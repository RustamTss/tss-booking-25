// Tiny helper to extract a meaningful error message from API responses
// Works with Axios-style errors and plain strings
export function getErrorMessage(
	error: unknown,
	fallback = 'Operation failed'
): string {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const e = error as any
	if (!e) return fallback
	// Direct string
	if (typeof e === 'string') return e
	// Axios response data possibilities
	const data = e?.response?.data
	if (typeof data === 'string' && data.trim().length > 0) return data
	if (data && typeof data === 'object') {
		if (typeof data.message === 'string' && data.message.trim().length > 0)
			return data.message
		if (typeof data.error === 'string' && data.error.trim().length > 0)
			return data.error
	}
	// Axios top-level message
	if (typeof e?.message === 'string' && e.message.trim().length > 0)
		return e.message
	return fallback
}
