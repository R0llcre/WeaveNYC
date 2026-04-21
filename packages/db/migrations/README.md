# packages/db/migrations

Forward-only, filename-ordered SQL migrations applied by
`pnpm --filter @weavenyc/db db:migrate` (see `../scripts/migrate.ts`).

## Numbering

Migrations are applied in lexical order of the 4-digit filename prefix.
`migrate.ts` keys the `schema_migrations` tracking table by filename
verbatim, so renaming an already-applied migration is a **destructive**
operation in prod (the tracker loses the row and the forward runner
re-applies the file, which then fails loudly on `CREATE ...` for objects
that already exist — or worse, succeeds with side effects).

### Reserved / skipped numbers

The following version numbers are **reserved** and MUST NOT be reused by
new migrations. They correspond to intentionally skipped slots in the
original development history; squashing them back in would break prod
schema ordering.

- `0011` — reserved (squashed into 0010 during M8 development).
- `0012` — reserved (squashed into 0010 during M8 development).

`scripts/migrate.ts` refuses at startup to apply any file whose
filename starts with one of these reserved prefixes. If you need to
recycle a reserved slot, remove it from both this list and the guard in
`scripts/migrate.ts` (and think very hard about what you are doing).

### Adding a new migration

1. Pick the next unused 4-digit prefix (currently 0016, 0017, …).
   **Never reuse a prefix** listed under "Reserved / skipped numbers".
2. Name the file `NNNN_short_snake_case_description.sql`.
3. Create the paired rollback file
   `NNNN_short_snake_case_description.rollback.sql` — `scripts/rollback.ts`
   fails loud if the pair is missing, and `test/rollback.test.ts`
   enforces the pair at CI time.
4. Wrap DDL in `BEGIN; ... COMMIT;` unless you explicitly need
   concurrent-safe DDL (e.g. `CREATE INDEX CONCURRENTLY`, which cannot
   run inside a transaction).

## Forward vs. rollback runner

- `pnpm db:migrate` — picks up `*.sql` files (skipping `*.rollback.sql`)
  and applies them in lexical order. Checksums are tracked; drift is a
  hard error.
- `pnpm db:migrate:rollback` — finds the most recently applied migration
  from `schema_migrations`, runs the paired `*.rollback.sql` inside a
  single transaction, and deletes the tracker row so a subsequent
  `db:migrate` reapplies the forward file.

See `docs/29_M8_Pilot_Readiness.md` §3.7 for the operator rollback SOP.
