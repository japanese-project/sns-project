# Database & ERD

The MVP uses a relational database for application data: Cloudflare D1 (SQLite) accessed through Drizzle ORM.

The schema is defined in `src/lib/server/db/schema/` (`auth.ts` for Better Auth's core tables, `sns.ts` for application tables) and the initial migration lives in `src/lib/server/db/migrations/`. Run `pnpm run db:generate` after schema changes, then `pnpm run db:migrate:local` (or `:remote`) to apply.

The `notification` table described below is planned for Phase 5 and is not yet part of the schema.

## Core entities

- **user** — Better Auth user identity and profile basics.
- **account** — Better Auth OAuth/provider account linkage.
- **session** — Better Auth persistent sessions when database session storage is selected.
- **post** — text content, author, visibility, timestamps, and optional image URL.
- **like** — one user-to-post like; unique per user/post pair.
- **comment** — a post comment or one-level reply; replies use `parent_comment_id`.
- **follow** — directed follower → followee relationship; unique pair and no self-follow.
- **notification** — in-app notification for likes, comments, and follows.

## ERD

```mermaid
erDiagram
    USER ||--o{ ACCOUNT : has
    USER ||--o{ SESSION : has
    USER ||--o{ POST : authors
    USER ||--o{ LIKE : creates
    USER ||--o{ COMMENT : writes
    USER ||--o{ FOLLOW : follows
    USER ||--o{ FOLLOW : followed_by
    USER ||--o{ NOTIFICATION : receives

    POST ||--o{ LIKE : has
    POST ||--o{ COMMENT : has
    COMMENT ||--o{ COMMENT : replies_to

    USER {
        string id PK
        string name
        string email UK
        string image
        datetime created_at
    }

    POST {
        string id PK
        string author_id FK
        string body
        string visibility
        string image_url
        datetime created_at
        datetime updated_at
    }

    LIKE {
        string user_id FK
        string post_id FK
        datetime created_at
    }

    COMMENT {
        string id PK
        string post_id FK
        string author_id FK
        string parent_comment_id FK
        string body
        datetime created_at
    }

    FOLLOW {
        string follower_id FK
        string followee_id FK
        datetime created_at
    }

    NOTIFICATION {
        string id PK
        string recipient_id FK
        string actor_id FK
        string type
        string post_id FK
        string comment_id FK
        boolean read
        datetime created_at
    }
```

## Constraints

- `post.visibility` is `public` or `followers-only`.
- A `like` is unique on (`user_id`, `post_id`).
- A `follow` is unique on (`follower_id`, `followee_id`) and cannot have identical follower/followee IDs.
- A reply must reference a comment on the same post.
- Only one reply level is allowed.
- Deleting a post cascades to its likes and comments at the database level.
- Comments/replies inherit the visibility of their parent post.
- Better Auth's generated core tables remain authoritative for auth-specific fields; app-specific profile fields should not duplicate auth data without a reason.

## Migration plan

Phase 1 creates the core schema and migrations before feature work. Better Auth's schema should be generated/configured for the chosen database/ORM, then application tables should be added through the same migration workflow.

If the database or auth storage architecture changes, update this document and [tech-stack.md](./tech-stack.md) in the same PR.
