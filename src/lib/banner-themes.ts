export interface BannerTheme {
	id: string
	name: string
	class_name: string
	preview_class: string
}

export const BANNER_THEMES: BannerTheme[] = [
	{
		id: 'default',
		name: 'Slate',
		class_name: 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-400',
		preview_class: 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-400',
	},
	{
		id: 'ocean',
		name: 'Ocean',
		class_name: 'bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500',
		preview_class: 'bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500',
	},
	{
		id: 'sunset',
		name: 'Sunset',
		class_name: 'bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600',
		preview_class: 'bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600',
	},
	{
		id: 'emerald',
		name: 'Emerald',
		class_name: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700',
		preview_class: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700',
	},
	{
		id: 'violet',
		name: 'Violet',
		class_name: 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700',
		preview_class: 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700',
	},
	{
		id: 'coral',
		name: 'Coral',
		class_name: 'bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400',
		preview_class: 'bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400',
	},
	{
		id: 'midnight',
		name: 'Midnight',
		class_name: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900',
		preview_class: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900',
	},
	{
		id: 'amber',
		name: 'Amber',
		class_name: 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-600',
		preview_class: 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-600',
	},
]

export function get_banner_class(theme_id?: string | null): string {
	if (!theme_id || theme_id === 'default') {
		return 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-400'
	}
	const found = BANNER_THEMES.find((t) => t.id === theme_id)
	return found ? found.class_name : 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-400'
}
