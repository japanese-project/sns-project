import { BOT_PERSONAS, type BotPersona } from './personas'

export interface BotConfig {
	enabled: boolean
	campaign_end: string | null // ISO date string or null
	interval_hours: number
	updated_at: string
}

const config_kv_key = 'sns_bot_config'
const custom_personas_kv_key = 'sns_bot_custom_personas'
const overrides_kv_key = 'sns_bot_persona_overrides'

// In-memory fallbacks if KV namespace is unavailable
let memory_config: BotConfig = {
	enabled: true,
	campaign_end: null,
	interval_hours: 3,
	updated_at: new Date().toISOString(),
}

let memory_custom_personas: BotPersona[] = []
let memory_overrides: Record<string, Partial<BotPersona>> = {}

export async function get_bot_config(kv?: KVNamespace | null): Promise<BotConfig> {
	if (!kv) {
		return { ...memory_config }
	}

	try {
		const raw = await kv.get(config_kv_key)
		if (!raw) {
			return { ...memory_config }
		}
		const parsed = JSON.parse(raw) as Partial<BotConfig>
		return {
			enabled: parsed.enabled ?? true,
			campaign_end: parsed.campaign_end ?? null,
			interval_hours: parsed.interval_hours ?? 3,
			updated_at: parsed.updated_at ?? new Date().toISOString(),
		}
	} catch (err) {
		console.warn('[Bot Config] Failed to read config from KV:', err)
		return { ...memory_config }
	}
}

export async function save_bot_config(
	updates: Partial<BotConfig>,
	kv?: KVNamespace | null,
): Promise<BotConfig> {
	const current = await get_bot_config(kv)
	const next: BotConfig = {
		enabled: updates.enabled !== undefined ? updates.enabled : current.enabled,
		campaign_end: updates.campaign_end !== undefined ? updates.campaign_end : current.campaign_end,
		interval_hours:
			updates.interval_hours !== undefined ? updates.interval_hours : current.interval_hours,
		updated_at: new Date().toISOString(),
	}

	memory_config = next

	if (kv) {
		try {
			await kv.put(config_kv_key, JSON.stringify(next))
		} catch (err) {
			console.error('[Bot Config] Failed to save config to KV:', err)
		}
	}

	return next
}

/**
 * Explicitly cancel or clear the scheduled end date, allowing bots to run continuously.
 */
export async function cancel_bot_campaign(kv?: KVNamespace | null): Promise<BotConfig> {
	return save_bot_config({ campaign_end: null }, kv)
}

/**
 * Retrieve custom bot personas created via the admin UI.
 */
export async function get_custom_personas(kv?: KVNamespace | null): Promise<BotPersona[]> {
	if (!kv) {
		return [...memory_custom_personas]
	}

	try {
		const raw = await kv.get(custom_personas_kv_key)
		if (!raw) return [...memory_custom_personas]
		const list = JSON.parse(raw) as BotPersona[]
		memory_custom_personas = list
		return list
	} catch (err) {
		console.warn('[Bot Config] Failed to read custom personas from KV:', err)
		return [...memory_custom_personas]
	}
}

/**
 * Save or update a custom bot persona.
 */
export async function save_custom_persona(
	persona: BotPersona,
	kv?: KVNamespace | null,
): Promise<void> {
	const current = await get_custom_personas(kv)
	const index = current.findIndex((b) => b.id === persona.id)
	let updated: BotPersona[]

	if (index >= 0) {
		updated = current.map((b, i) => (i === index ? { ...b, ...persona } : b))
	} else {
		updated = [...current, persona]
	}

	memory_custom_personas = updated

	if (kv) {
		try {
			await kv.put(custom_personas_kv_key, JSON.stringify(updated))
		} catch (err) {
			console.error('[Bot Config] Failed to save custom persona to KV:', err)
		}
	}
}

/**
 * Delete a custom bot persona from KV.
 */
export async function delete_custom_persona(
	bot_id: string,
	kv?: KVNamespace | null,
): Promise<void> {
	const current = await get_custom_personas(kv)
	const updated = current.filter((b) => b.id !== bot_id)
	memory_custom_personas = updated

	if (kv) {
		try {
			await kv.put(custom_personas_kv_key, JSON.stringify(updated))
		} catch (err) {
			console.error('[Bot Config] Failed to delete custom persona from KV:', err)
		}
	}
}

/**
 * Retrieve persona overrides (custom prompt, feeds, etc. for built-in or custom bots).
 */
export async function get_persona_overrides(
	kv?: KVNamespace | null,
): Promise<Record<string, Partial<BotPersona>>> {
	if (!kv) {
		return { ...memory_overrides }
	}

	try {
		const raw = await kv.get(overrides_kv_key)
		if (!raw) return { ...memory_overrides }
		const parsed = JSON.parse(raw) as Record<string, Partial<BotPersona>>
		memory_overrides = parsed
		return parsed
	} catch (err) {
		console.warn('[Bot Config] Failed to read persona overrides from KV:', err)
		return { ...memory_overrides }
	}
}

/**
 * Save an override for a specific bot persona.
 */
export async function save_persona_override(
	bot_id: string,
	override: Partial<BotPersona>,
	kv?: KVNamespace | null,
): Promise<void> {
	const current = await get_persona_overrides(kv)
	const updated = {
		...current,
		[bot_id]: {
			...(current[bot_id] || {}),
			...override,
		},
	}
	memory_overrides = updated

	if (kv) {
		try {
			await kv.put(overrides_kv_key, JSON.stringify(updated))
		} catch (err) {
			console.error('[Bot Config] Failed to save persona override to KV:', err)
		}
	}
}

/**
 * Returns all active bot personas (built-in + custom) with any persona overrides applied.
 */
export async function get_all_active_personas(kv?: KVNamespace | null): Promise<BotPersona[]> {
	const [custom, overrides] = await Promise.all([
		get_custom_personas(kv),
		get_persona_overrides(kv),
	])

	const combined = [...BOT_PERSONAS]

	for (const c of custom) {
		if (!combined.some((b) => b.id === c.id)) {
			combined.push(c)
		}
	}

	return combined.map((persona) => {
		const override = overrides[persona.id]
		if (override) {
			return {
				...persona,
				...override,
			}
		}
		return persona
	})
}
