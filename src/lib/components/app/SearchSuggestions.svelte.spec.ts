import { page } from 'vitest/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { search_history } from '$lib/search-history.svelte'
import SearchSuggestions from './SearchSuggestions.svelte'

describe('SearchSuggestions Component', () => {
	beforeEach(() => {
		search_history.clear()
	})

	it('renders empty guide state when there is no history or trending topics', async () => {
		const on_select = vi.fn()
		render(SearchSuggestions, {
			on_select,
			trending_topics: [],
		})

		await expect
			.element(page.getByText('Search for people, keywords, or #topics'))
			.toBeInTheDocument()
	})

	it('renders recent searches and handles item click and clear all', async () => {
		search_history.add('svelte 5')
		search_history.add('cloud-native')

		const on_select = vi.fn()
		render(SearchSuggestions, {
			on_select,
			trending_topics: [],
		})

		await expect.element(page.getByText('Recent searches')).toBeInTheDocument()
		const svelte_item = page.getByRole('button', { name: /svelte 5/ })
		await expect.element(svelte_item).toBeInTheDocument()

		await svelte_item.click()
		expect(on_select).toHaveBeenCalledWith('svelte 5')

		const clear_btn = page.getByRole('button', { name: 'Clear all' })
		await clear_btn.click()
		expect(search_history.items).toHaveLength(0)
	})

	it('renders popular trending topics and formats query with hashtag', async () => {
		const on_select = vi.fn()
		render(SearchSuggestions, {
			on_select,
			trending_topics: [{ tag: 'webdev' }, { tag: 'typescript' }],
		})

		await expect.element(page.getByText('Popular topics')).toBeInTheDocument()
		const topic_btn = page.getByRole('button', { name: /#webdev/ })
		await expect.element(topic_btn).toBeInTheDocument()

		await topic_btn.click()
		expect(on_select).toHaveBeenCalledWith('#webdev')
	})
})
