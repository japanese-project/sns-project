export interface BotConfig {
	enabled: boolean
	campaign_end: string | null // ISO date string or null
	interval_hours: number
	updated_at: string
}

const config_kv_key = 'sns_bot_config'

// In-memory fallback if KV namespace is unavailable
let memory_config: BotConfig = {
	enabled: true,
	campaign_end: null,
	interval_hours: 3,
	updated_at: new Date().toISOString(),
}

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
