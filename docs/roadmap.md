# Roadmap & Product Specification

A social networking service (SNS) where users share updates, follow people, discover content, and engage through likes and comments.

This document serves as the single source of truth for both **backend business logic/authorization** and **expected frontend UX behavior**.

---

## 1. Product Scope & Phase Breakdown

| Phase        | Milestone                | Scope                                                                                                                                                                    | Status      |
| ------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| **Phase 1**  | Foundation               | Scaffolding, Drizzle relational schema, migrations, Google OAuth with Cloudflare KV session cache.                                                                       | Complete    |
| **Phase 2**  | Posts & Global Feed      | Text posts (500 chars), public vs. followers-only visibility, cursor-paginated feed.                                                                                     | Implemented |
| **Phase 3**  | Social Engagement        | Likes (idempotent toggle, optimistic UI), comments with 1-level nested replies.                                                                                          | Implemented |
| **Phase 4**  | Social Graph             | Follow / unfollow with instant feedback, relationship-based visibility unlocks.                                                                                          | Implemented |
| **Phase 5**  | Completeness & Discovery | Post ownership controls (edit & cascade delete), user profiles (`/u/:username`), follower/following lists, search (`/explore`), in-app notifications (`/notifications`). | Implemented |
| **Phase 5B** | Media / Image Upload     | Single image attachment per post, served via Cloudflare R2 / Images with CDN caching. _(Split into dedicated issue/PR #19)_                                              | Next        |
| **Post-MVP** | Advanced Social          | Direct messaging, hashtags/mentions, bookmarks/reposts, private accounts, block/mute, push notifications.                                                                | Later       |

> **Note on Image Upload (#19):**  
> Image upload is separated from the core Phase 5 PR into a dedicated follow-up. Storing binary assets requires configuring Cloudflare R2 buckets, presigned upload URLs, client-side resizing/compression, CDN caching, and cleanup hooks on post deletion. Isolating this prevents storage plumbing from holding up core social interactions.

---

## 2. Access Model: Signed-In Users Only

The app is for signed-in users only. There is no guest mode: no guest sessions, no signed-out views and no "sign in to continue" prompts inside the app. A request without a session can reach only three things; every other route rejects it itself.

### What a request without a session can reach

| Path           | Purpose                                                                                                 | Behavior without a session                               |
| -------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `/login`       | Google sign-in page. Signed-in users are redirected to `/`.                                             | ✅ Reachable                                             |
| `/api/auth/*`  | Better Auth endpoints the sign-in flow calls (OAuth start/callback, session lookup).                    | ✅ Reachable                                             |
| `/api/health`  | Deployment health probe used by the preview/production workflows. Returns binding status, no user data. | ✅ Reachable                                             |
| Any other page | `/`, `/explore`, `/u/*`, `/posts/*`, `/notifications`, `/profile`, ...                                  | ❌ Redirect (302) to `/login`                            |
| Any other API  | `/api/posts`, `/api/search`, `/api/trending`, `/api/users/*`, `/api/notifications/*`, ...               | ❌ `401` JSON `{ "message": "Authentication required" }` |

There is no central allowlist or guest handling. Every API handler checks the session itself (`require_user_id` → `401`) and every page load does too (`require_session_user` → redirect to `/login`, which also works for client-side navigations), so a session that expires mid-visit lands on `/login` at the next navigation. The only routes without that check are the three above.

`src/routes/route-guards.spec.ts` keeps this from regressing: it discovers every API handler and page load, calls each one with no session, and fails if any does not reject first (before touching the database) or if a page has no server load, with no exceptions. A newly added route that forgets its check therefore fails CI instead of becoming public.

### Route Behavior (signed in)

| Route                                   | Behavior                                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `/` (Home Feed)                         | Following / Global feed. Nav includes Home, Create post, Explore, Notifications, Profile and Sign out. "Share a thought…" composer. |
| `/explore`                              | Search and discovery; can follow users directly from search results.                                                                |
| `/u/:username`                          | Profile view. Shows followers-only posts if following. Shows "Follow" / "Unfollow" button (or Edit Profile if own profile).         |
| `/u/:username/followers` & `/following` | Reads lists and follows/unfollows individuals directly.                                                                             |
| `/posts/:id` (Permalink)                | Views post, likes, comments, or deletes (if owner).                                                                                 |
| `/notifications`                        | Views in-app activity, marks items read, views unread badge.                                                                        |
| `/profile`                              | Redirects (302) to the user's canonical handle `/u/:username`.                                                                      |

### Action Authorization Matrix

| Action                       | Non-follower       | Follower           | Author / Owner          |
| ---------------------------- | ------------------ | ------------------ | ----------------------- |
| **Read public post**         | ✅ Allowed         | ✅ Allowed         | ✅ Allowed              |
| **Read followers-only post** | ❌ 404 (Hidden)    | ✅ Allowed         | ✅ Allowed              |
| **Create post**              | ✅ Allowed         | —                  | —                       |
| **Edit own post**            | ❌ 403 Forbidden   | ❌ 403 Forbidden   | ✅ Allowed              |
| **Delete own post**          | ❌ 403 Forbidden   | ❌ 403 Forbidden   | ✅ Allowed (Cascades)   |
| **Like / unlike post**       | ✅ If post visible | ✅ If post visible | ✅ Allowed              |
| **Comment / reply**          | ✅ If post visible | ✅ If post visible | ✅ Allowed              |
| **Follow / unfollow user**   | ✅ Allowed         | ✅ Allowed         | ❌ 400 (No self-follow) |
| **View notifications**       | ✅ Own only        | ✅ Own only        | ✅ Own only             |

**Key Authorization Principles:**

1. **Signed-in only:** every feature, including reading public posts, profiles and follower lists, requires a session. Post visibility (`public` vs. `followers-only`) is a rule between signed-in users, not between signed-in users and visitors.
2. **Never leak existence:** If a user requests a post or profile they are not authorized to see (e.g. a followers-only post requested by a non-follower), the API and page MUST return **404 Not Found**, never 403.
3. **Cascading visibility:** Comments and replies strictly inherit the visibility of their parent post.
4. **No guest logic in the app:** components and services assume a signed-in viewer. There are no `signed_in` flags, nullable viewers or login nudges to maintain.

---

## 3. Profile Model & Lifecycle

A user's profile is how they appear to other signed-in users.

### Data Attributes

- **ID (`id`):** System unique identifier (UUID/CUID).
- **Display Name (`name`):** Human-friendly name (e.g. "Ada Lovelace"). Non-unique, editable.
- **Username / Handle (`username`):** URL slug (e.g. `@ada`). Unique, lowercase alphanumeric characters plus underscores (`^[a-z0-9_]{3,30}$`).
  - _Bootstrap Rule:_ Automatically generated on first login from email prefix. If taken, a numerical suffix is appended.
  - _Fallback Rule:_ If a user somehow lacks a handle, routes fall back to `/u/<user_id>` gracefully.
  - _Change Rule (MVP limitation):_ Users may change their username. The old handle is **not** kept as an alias or redirect, so existing links and bookmarks to `/u/<old>` stop resolving. `/u/<user_id>` always resolves and is the stable permalink. The edit form warns about this, and after a successful change the app navigates to the new `/u/<new>` URL (replacing the old history entry) so the address bar matches the profile. _Post-MVP:_ a username-history table plus a reservation policy would allow old handles to redirect.
- **Bio (`bio`):** Short user bio (max 160 characters), plaintext. Optional; set during onboarding, editable from Edit Profile, and shown on the profile page.
- **Avatar (`image`):** Profile picture URL. When null, UI renders an accessible initials-based avatar chip.
- **Joined Date (`created_at`):** Displayed formatted as "Joined Month Year" (e.g., "Joined October 2026").
- **Stats:** Live counts of Followers, Following, and Posts.

### Future Profile Enhancements (Post-MVP)

- **Account Privacy:** Toggle between an open profile (any signed-in user can view it) and an approval-required private profile.
- **Moderation:** Block and mute lists to protect users from unwanted interactions.

---

## 4. Feed & Discovery Models

To allow clean platform growth, content delivery is structured into two distinct concepts:

### 1. Home Feed (`/`)

- **Personal stream:** In MVP, displays visible posts newest-first. Evolves post-MVP to prioritize posts by followed users alongside own posts.
- **Pagination:** Strict cursor pagination on `(created_at, id)` descending. Prevents duplicate items or skips when new posts are created while scrolling.

### 2. Explore & Search (`/explore`)

- **Discovery Engine:** Global discovery space for finding new voices and topics.
- **People Search:** Case-insensitive prefix/sub-string search on `@username` and display name.
- **Post Search:** Full-text substring search across visible posts with SQL wildcard escaping (`%` and `_`).
- **Follow directly:** Users can follow people directly from search result rows with immediate optimistic UI feedback.

### 3. Discovery Behavior & Known Limitations (MVP)

These are deliberate trade-offs for the expected workload (< 10k users / posts). Each is bounded per request.

- **People suggestions by interest:** Matches against **all** users in the database (interests are matched in SQL over the stored JSON list), excluding yourself and people you follow, newest accounts first, up to the requested limit (max 50). There is no "latest N users" window. Matching is case-insensitive for ASCII only. It still scans the user table per request; at larger scale, normalise interests into an indexed `user_interest` table.
- **Trending topics:** Computed from a **sample**: the 500 most recent public posts that contain a `#` within the selected window (`today` / `week` / `month`). Posts without a hashtag don't use up that budget. Once a window holds more than 500 hashtagged posts, tags whose posts fall outside the newest 500 drop out even if still active, and counts are per sampled post rather than exact totals. At larger scale, use a materialized tag-count table or scheduled job.
- **Post search:** A case-insensitive substring (`LIKE`) scan over visible posts. Cost per request is bounded by the query-length cap, page size and cursor pagination, but grows linearly with the posts table; at larger scale move to SQLite FTS5 or a search service.
- **No rate limiting or response caching** is applied to these endpoints in the app. They require a session, so exposure is limited to signed-in accounts, but a signed-in user can still call them in a loop; add edge rules (e.g. Cloudflare rate limiting) before opening sign-up widely.

---

## 5. In-App Notifications Specification

Notifications inform users of social feedback without overwhelming them.

### Trigger Matrix & De-duplication

| Trigger Event        | Recipient             | Deduplication Policy                                                                         | Reversal on Undo                                                       |
| -------------------- | --------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Like Post**        | Post author           | Deduplicated per `(actor, post)`. Key: `like:<actor>:<post>`.                                | Unliking permanently removes the notification. Re-liking recreates it. |
| **New Follower**     | Followed user         | Deduplicated per `(actor, recipient)`. Key: `follow:<actor>:<recipient>`.                    | Unfollowing removes the notification.                                  |
| **Comment on Post**  | Post author           | NOT deduplicated. Each unique comment produces a notification.                               | Deleting comment cascades delete to notification.                      |
| **Reply to Comment** | Parent comment author | NOT deduplicated. Each reply notifies the parent comment author.                             | Deleting comment cascades delete to notification.                      |
| **Self-Action**      | —                     | **Suppressed:** Users never receive notifications for their own likes, comments, or replies. | —                                                                      |

### Deep Linking & Navigation UX

Notifications must take users directly to the referenced content:

- **Like / Comment / Reply:** Deep-links directly to the post permalink (`/posts/:id`).
- **Follow:** Links to the follower's profile (`/u/:username`).
- **Mark-as-Read:** Clicking any notification marks it read immediately (optimistic UI), decrementing the unread badge. The request is sent with `keepalive`, so it still completes if the click triggers a full-page navigation; navigation itself is never delayed waiting for it.
- **Mark All as Read:** Header action clears all unread indicators at once.
- **Unread Badge Refresh:** The nav badge refreshes when the shell mounts (only if the last count is older than 60 seconds), every 60 seconds, and immediately when notifications change (mark read). It deliberately does not refresh on every route change; navigating doesn't alter the count.

---

## 6. Frontend UX & Design Guidelines

The frontend implements the visual direction defined in `docs/design/*.png`.

### Navigation Architecture

- **Desktop (`md:` breakpoint and above):**
  - Left-docked floating pill nav (`fixed left-6 top-1/2 -translate-y-1/2`).
  - Contains icon buttons: Home, Explore, Notifications (with unread badge), Profile Avatar, and Sign Out.
  - Active route displays with high-contrast active background (`bg-white shadow-sm`); idle items have subtle hover states.
- **Mobile (`< md`):**
  - Bottom-docked floating pill nav (`fixed bottom-4 left-1/2 -translate-x-1/2`).
  - Touch-friendly icon targets (minimum 44×44px hit area).
- **Top Pill Header:**
  - Floats centered at the top of the viewport.
  - Displays current context / page title (e.g., "Home", "Explore", "Activity", "Profile").
  - Includes a quick-action trigger: "Share a thought…".

### Post Composer UX

- **Modal Presentation:** Clean rounded dialog modal with backdrop blur. Pressing `Escape` or clicking the backdrop cancels with no state loss.
- **Character Counter:** Real-time remaining count (starts at 500). Shifts to warning/rose styling when exceeded.
- **Visibility Toggle:** Clear pill selector between `Public` (globe icon) and `Followers` (lock icon).
- **Submission:**
  - Publish button is disabled when empty or exceeding limits.
  - On submit, button transitions to loading state (`Publishing…`).
  - Upon success, modal closes smoothly and the newly created post is prepended to the top of the feed without requiring a page reload.

### Interaction States & Micro-interactions

- **Optimistic Likes:** Heart icon fills red and counter increments instantly upon click. If the backend fails, the change is rolled back with a non-intrusive error notice.
- **Inline Comments:** Expanding comments opens an inline thread without page navigation. Replying to another user shows an active "Replying to @user" tag.
- **Follow Buttons:** High-contrast toggle ("Follow" in dark pill vs. "Following" in light outline). Updates follower counts live.

### Resilient State Handling

- **Loading Skeletons:** Animated pulsating placeholder cards matching the exact dimensions of post cards to prevent Cumulative Layout Shift (CLS).
- **Empty States:** Clear, centered icon and friendly copy guiding the user (e.g. "No posts yet. Be the first to share something.").
- **Error States:** Informative error cards with an explicit "Try again" retry button.
- **Deleted Content:** If a post is deleted by its author, it transitions out of feed lists gracefully. Accessing a permalink to a deleted post serves an informative 404 page with a "Back to feed" link.

### Design Tokens & Consistency

- **Border Radii:** Consistent soft curves — cards use `rounded-[2rem]`, buttons use `rounded-full`, form inputs use `rounded-2xl`.
- **Color Palette:** Slate neutrals with subtle indigo ambient gradients (`from-slate-50 via-indigo-50/60 to-slate-100`). Rose accent for likes/warnings.
- **Typography:** System sans-serif font stack with tabular figures (`tabular-nums`) for counters and timestamps.
