// View models returned by the server services and the JSON API.
// Dates are ISO-8601 strings so they survive JSON serialisation unchanged.

export interface UserSummary {
	id: string
	name: string
	username: string | null
	/** Value used in /u/:handle URLs: the username, or the id for users without one yet. */
	handle: string
	image: string | null
	bio?: string | null
}

export interface UserListItem extends UserSummary {
	is_following: boolean
	is_followed_by?: boolean
	is_self: boolean
}

export interface PostView {
	id: string
	content: string
	visibility: 'public' | 'followers-only'
	image_url: string | null
	created_at: string
	updated_at: string
	author: UserSummary
	like_count: number
	comment_count: number
	liked_by_me: boolean
	is_owner: boolean
}

export interface CommentView {
	id: string
	post_id: string
	parent_id: string | null
	content: string
	created_at: string
	updated_at?: string
	author: UserSummary
	replies: CommentView[]
	is_owner: boolean
}

export interface NotificationView {
	id: string
	type: 'like' | 'comment' | 'follow'
	read: boolean
	created_at: string
	actor: UserSummary
	post_id: string | null
	/** Short excerpt of the post (like) or comment (comment) the notification refers to. */
	snippet: string | null
}

export interface ProfileView {
	user: UserSummary
	bio: string | null
	interests: string[]
	joined_at: string
	follower_count: number
	following_count: number
	is_following: boolean
	is_followed_by: boolean
	is_self: boolean
}

export interface Page<T> {
	items: T[]
	next_cursor: string | null
}

export type TrendingPeriod = 'today' | 'week' | 'month'
