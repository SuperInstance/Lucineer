# prisma/

Prisma ORM schema for SuperInstance Ranch. Uses SQLite for local development and production on Jetson.

## Apply Schema

```bash
make db-push     # apply schema changes (non-destructive)
make db-reset    # reset and re-migrate (destructive — wipes data)
```

Or directly:

```bash
bunx prisma db push
bunx prisma studio   # open visual DB editor
```

## Key Models

| Model | Description |
|---|---|
| `User` | Ranch owner accounts and herd configuration |
| `LLN` nodes | Local Learning Network samples — the 127k synthetic training corpus |
| `CRDT` state | Agent memory pasture entries with vector embeddings and merge metadata |
| `Agent` cells | Individual agent definitions: role, system prompt, LoRA adapter path, scores |
| Learning | Gamification state — XP, levels, synthesis streaks per agent |

## Database Location

Default: `db/ranch.db` (SQLite file, relative to project root).

Set `DATABASE_URL` in `.env` to change. For production with multiple Ranch nodes, switch to PostgreSQL:

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/ranch"
```

Prisma supports both SQLite and PostgreSQL with the same schema — just change the `provider` in `schema.prisma`.

## Migrations

```bash
bunx prisma migrate dev --name my-change   # create migration
bunx prisma migrate deploy                  # apply in production
```
