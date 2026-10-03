# Comment abuse protection

`POST /api/posts/{id}/comments` enforces authentication, post visibility, and comment limits on the server. Comments must contain 1–500 characters; each user may post at most 6 comments per minute, at least 1.5 seconds apart.

Recent activity is stored in Cloudflare KV per user, so limits apply across posts. KV updates are not atomic, so simultaneous requests may exceed the limit.
