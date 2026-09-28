# Roadmap

A small social app — users register, post text updates, follow each other, and interact via likes and comments.

## Scope

| Area             | Status                 |
| ---------------- | ---------------------- |
| Phases 1–5 below | **MVP must-have**      |
| Post-MVP section | **Later / out of MVP** |

The five MVP phases go in order, each starting once the previous phase is merged to `main`. A feature is not considered complete until its backend authorization rules and the relevant tests are covered.

## Authorization rules

These rules apply to the MVP unless a phase explicitly says otherwise:

| Resource / action            | Public visitor | Authenticated user                | Author / owner | Follower |
| ---------------------------- | -------------- | --------------------------------- | -------------- | -------- |
| Read public post             | Yes            | Yes                               | Yes            | Yes      |
| Read followers-only post     | No             | No, unless they follow the author | Yes            | Yes      |
| Create post                  | No             | Yes                               | —              | —        |
| Edit/delete post             | No             | No                                | Yes            | No       |
| Like/unlike visible post     | No             | Yes                               | Yes            | Yes      |
| Read/comment on visible post | No             | Yes                               | Yes            | Yes      |
| Follow/unfollow user         | No             | Yes                               | —              | —        |

**Visibility rule:** followers-only access is based on the relationship between the viewer and the post author. The author can always see their own post.

**Comment rule:** comments and replies inherit the visibility of their parent post. A followers-only post must never expose its comments or replies to a viewer who cannot read the post itself.

**Public means public:** public posts and their comments are readable without following the author. Mutating actions still require authentication.

**Phase 2 pre-follow behavior:** until Phase 4 creates real follow relationships, a followers-only post is visible only to its author.

### Authorization tests

At minimum, the implementation must cover:

1. Anonymous users can read public posts.
2. Anonymous users cannot read followers-only posts.
3. A post author can read their own followers-only post.
4. A follower can read the followed author's followers-only post.
5. A non-follower cannot read another user's followers-only post.
6. A non-follower cannot read comments/replies belonging to a followers-only post.
7. Only the post owner can edit/delete a post.
8. A user cannot follow themselves.
9. Unauthenticated users cannot create, like, comment, follow, edit, or delete.

## Phase 1 — Foundation · MVP must-have

**Deliver:** repo scaffold with CI green, full DB schema migrated, and working Google OAuth login (sign in, session persists on reload, logout, protected routes redirect when logged out).

### Project setup

- Repo scaffold, env vars, DB connection, CI passing
- **Backend:** Drizzle schema + migrations wired to the relational database; schema covers the core app entities in [database.md](./database.md)
- **Frontend:** base layout, routing skeleton

### Auth (Login with Google)

- Sign in with Google OAuth — no separate register form, first login creates the account
- Session persists on reload, logout
- **Backend:** Better Auth Google OAuth provider (client ID/secret), session endpoints
- **Frontend:** "Sign in with Google" button, OAuth redirect handling, protected routes redirect to login when logged out

**Watch for:**

- Cloudflare KV is required as Better Auth's `secondaryStorage`: session/verification/rate-limit data is kept there, not just in the database. This must be wired up explicitly in the auth configuration before Phase 1 is complete. KV is not the source of truth for posts, likes, comments, follows, or profiles.
- Google OAuth client ID/secret need both a local `.env` and a `wrangler secret put` for the deployed Worker. Add an `.env.example` with variable names before implementation lands.
- The DB schema is being designed for all 5 phases up front. A later requirements change means a migration, not an undocumented schema edit.

## Phase 2 — Posts · MVP must-have

**Deliver:** logged-in users can create a text post (public or followers-only), and a paginated global feed shows posts newest-first, honoring visibility.

### Create post

- Text only, required, max length (e.g. 500 chars), must be logged in
- Visibility, chosen at creation: **public** (default) or **followers-only**
- **Backend:** create-post endpoint — validate non-empty + max length + visibility enum, attach author + timestamp
- **Frontend:** composer with character counter, public/followers-only toggle, disabled submit when invalid

### Feed

- Global — shows posts from all users, newest first, paginated (not filtered to who you follow)
- Followers-only posts are hidden from everyone except the author and their followers
- Each post shows author name + timestamp
- **Backend:** list-posts endpoint, filtered to `visibility = public OR author = viewer OR viewer follows author`, paginated, joins author
- **Frontend:** feed list, loading + empty states, "load more" / infinite scroll

**Watch for:**

- The visibility filter depends on the `follows` table. Write the anonymous/non-follower/author visibility tests now, then repeat the follower case after Phase 4.
- Pick a pagination strategy now: cursor-based (`created_at`, `id`) is recommended over offset.

## Phase 3 — Engagement · MVP must-have

**Deliver:** users can like/unlike a post with a visible count, and comment on posts with one level of nested replies.

### Like

- One like per user per post (toggle, not stack), visible count, must be logged in
- **Backend:** `likes` table with unique (user, post), toggle endpoint, count
- **Frontend:** like button reflects current state, optimistic update on click

### Comment

- Text required, max length, must be logged in
- Two levels: top-level comments (oldest-first under the post) and one-level replies to a comment (oldest-first under their parent)
- Replying to a reply attaches to that reply's top-level parent — no deeper nesting
- **Backend:** `comments` table with nullable `parent_comment_id` (self-referencing), create/list endpoints, attach author + timestamp, validation rejects a `parent_comment_id` that already has a parent
- **Frontend:** comment list with replies nested one level under their parent, "Reply" button on top-level comments only

**Watch for:**

- Like toggle needs an upsert (`ON CONFLICT`), not just a unique constraint.
- Optimistic like/comment UI needs a rollback path when the request fails.
- Comments inherit the parent post's visibility. Both comment-list and comment-create endpoints must enforce the same authorization check as reading the post.

## Phase 4 — Social graph · MVP must-have

**Deliver:** users can follow/unfollow another user from their profile, with state reflected immediately — and Phase 2's followers-only visibility now works against real follow relationships.

### Follow

- Can't follow yourself, toggle follow/unfollow, state reflected immediately
- **Backend:** `follows` table with unique (follower, followee), self-follow guard, follow/unfollow endpoints
- **Frontend:** follow/unfollow button on profile, reflects current state

**Watch for:**

- Regression-test followers-only visibility with real follow data.
- Follow/unfollow needs the same optimistic-update rollback as Like.
- Follower/following lists are public in MVP; private accounts are post-MVP.

## Phase 5 — Completeness · MVP must-have

**Deliver:** post owners can edit/delete their posts; profile pages, followers/following lists, username/post search, in-app notifications, and image upload on posts all ship.

### Edit / Delete post

- Owner-only, delete removes its likes/comments too
- **Backend:** update/delete endpoints, ownership check, DB-level cascade delete
- **Frontend:** edit/delete controls shown only on own posts

### Profile page

- Shows a user's posts + basic info (name, joined date)
- **Backend:** list-posts-by-user endpoint
- **Frontend:** profile page route (`/u/:username`)

### Followers / Following list

- Paginated list of usernames
- **Backend:** list-followers / list-following endpoints
- **Frontend:** list pages linked from profile

### Search

- Search by username or post text, case-insensitive
- **Backend:** simple match endpoint, no ranking needed for MVP
- **Frontend:** search bar + results page

### Notifications (in-app)

- One entry per like/comment/follow, mark-as-read, unread count
- **Backend:** `notifications` table, written on like/comment/follow, list + mark-read endpoints
- **Frontend:** notification bell with unread badge, list dropdown/page

### Upload image

- One image per post, size/type limit, served from object storage
- **Backend:** object storage (see [tech-stack](./tech-stack.md)), image URL on post, size/type validation
- **Frontend:** image picker + preview in composer

**Watch for:**

- Cascade delete should be a DB-level `ON DELETE CASCADE`, not app-level cleanup code.
- Decide notification de-duplication before implementation.
- Search is intentionally a simple unranked match at MVP scale; treat indexing/ranking as a later optimization.
- Pick the object-storage service before Phase 5 starts.

## Post-MVP · later

These are explicitly deferred and are **not required for the MVP**:

- Direct messages / real-time chat
- Real-time notifications (push, email)
- Online / offline status
- Hashtags / mentions
- Share / repost, save / bookmark
- Account settings, private accounts, block / mute, report
- Two-factor auth
- Explore / trending, recommendations
- Moderation
- Performance optimization
- Monitoring
- Scaling
