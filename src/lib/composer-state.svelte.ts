// Shared open/close state for the "Share a thought…" composer modal and a hook that
// lets the feed prepend a freshly created post without reloading.
import type { PostView } from './types'

let open = $state(false)
let listeners: ((post: PostView) => void)[] = []

export const composer = {
	get open() {
		return open
	},
	show() {
		open = true
	},
	hide() {
		open = false
	},
	on_created(listener: (post: PostView) => void) {
		listeners = [...listeners, listener]
		return () => {
			listeners = listeners.filter((l) => l !== listener)
		}
	},
	created(post: PostView) {
		for (const listener of listeners) listener(post)
	},
}
