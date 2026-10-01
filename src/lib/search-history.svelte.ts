const storage_key = 'sns_recent_searches'
const max_items = 10

function load_items(): string[] {
	if (typeof window === 'undefined') return []
	try {
		const raw = localStorage.getItem(storage_key)
		return raw ? (JSON.parse(raw) as string[]) : []
	} catch {
		return []
	}
}

function save_items(items: string[]) {
	if (typeof window === 'undefined') return
	try {
		localStorage.setItem(storage_key, JSON.stringify(items))
	} catch {
		// Ignore storage quota errors
	}
}

function create_search_history() {
	let items = $state<string[]>(load_items())

	return {
		get items() {
			return items
		},
		add(query: string) {
			const trimmed = query.trim()
			if (!trimmed) return
			const filtered = items.filter((i) => i.toLowerCase() !== trimmed.toLowerCase())
			items = [trimmed, ...filtered].slice(0, max_items)
			save_items(items)
		},
		remove(query: string) {
			items = items.filter((i) => i.toLowerCase() !== query.toLowerCase())
			save_items(items)
		},
		clear() {
			items = []
			save_items(items)
		},
	}
}

export const search_history = create_search_history()
