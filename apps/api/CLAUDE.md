# apps/api — NestJS 12 · Prisma 7 · PostgreSQL · Redis/BullMQ

Root rules in `/CLAUDE.md` apply. This file adds API-specific conventions. Architecture: `docs/ARCHITECTURE.md §4.1, §4.2, §5`.

## Layout reminders

- `src/main.ts` → HTTP process. `src/worker.ts` → `NestFactory.createApplicationContext(WorkerModule)`: BullMQ processors + cron. **Processors and cron jobs are registered only in `WorkerModule`** (each module that has jobs exposes a `<Name>WorkerModule`), so the HTTP process never consumes jobs.
- `src/common/` = framework glue (no business rules). `src/infrastructure/` = adapters to external systems behind ports. `src/modules/<name>/` = business modules following ARCHITECTURE §4.2.
- Path alias `@/*` → `src/*`. Shared schemas: `import { CreateArticleSchema, type CreateArticleInput } from '@newsroom/contracts'`.
- Prisma client is generated to `src/generated/prisma` (git-ignored). Import types/enums from `@/generated/prisma/client`.

## Prisma 7 specifics (do not regress to Prisma 5/6 patterns)

- Connection URL is in `prisma.config.ts` (`datasource.url`), **not** in `schema.prisma`. Seed command is configured there too.
- Generator is `prisma-client` with explicit `output` (not `prisma-client-js`, not `@prisma/client` imports).
- Runtime client needs the driver adapter:

```ts
// src/infrastructure/database/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { AppConfigService } from '@/config/app-config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.database.url }) });
  }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

- First migration must include `prisma/sql/001_extensions_and_search.sql` (extensions at the top, trigger at the bottom). Use `--create-only`, edit, then apply.

## Canonical patterns (copy these shapes)

**Controller** — thin, schema-validated, permission-declared:

```ts
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Patch(':id')
  @RequirePermissions('article.create')            // coarse gate; ownership in policy
  async update(
    @Param({ schema: IdParamSchema }) { id }: IdParam,
    @Body({ schema: UpdateArticleSchema }) body: UpdateArticleInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ArticleDetailResponse> {
    const article = await this.articles.update(id, body, user);
    return ArticleMapper.toDetail(article, user);
  }
}
```
(NestJS 12 validates `{ schema }` params with the built-in `StandardSchemaValidationPipe`. If the installed version's API differs, adapt once in `common/` and keep controllers unchanged.)

**Service** — use-case, policy, transaction, events after success:

```ts
@Injectable()
export class ArticlesService {
  constructor(
    private readonly repo: ArticlesRepository,
    private readonly content: ArticleContentService,
    private readonly events: EventEmitter2,
  ) {}

  @Transactional()
  async update(id: string, input: UpdateArticleInput, user: AuthUser) {
    const article = await this.repo.findByIdOrThrow(id);
    if (!ArticlePolicy.canEdit(user, article)) throw new ForbiddenError(ErrorCode.ARTICLE_EDIT_FORBIDDEN);
    const processed = input.content ? this.content.process(input.content) : undefined;
    const updated = await this.repo.updateWithVersion(id, input.version, { ...input, ...processed });
    if (!updated) throw new ConflictError(ErrorCode.ARTICLE_VERSION_CONFLICT);
    this.events.emit(ArticleEvents.UPDATED, new ArticleUpdatedEvent(updated.id, user.id));
    return updated;
  }
}
```

**Repository** — the only Prisma user; soft-delete aware; transaction-aware:

```ts
@Injectable()
export class ArticlesRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {}
  private get db() { return this.txHost.tx; }

  findById(id: string) {
    return this.db.article.findFirst({ where: { id, deletedAt: null }, include: articleDetailInclude });
  }

  async updateWithVersion(id: string, version: number, data: ArticleUpdateData) {
    const { count } = await this.db.article.updateMany({
      where: { id, version, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    return count === 1 ? this.findById(id) : null;
  }
}
```
`ArticleUpdateData` must not contain `status` — status changes only through `WorkflowService` (ARCHITECTURE §8.3).

**Policy** — pure, unit-tested, no I/O:

```ts
export const ArticlePolicy = {
  canEdit(user: AuthUser, a: ArticleForPolicy): boolean { /* rules from ARCHITECTURE §7 and §8.4 */ },
};
```

**Mapper** — never return Prisma rows; map to the contract response type (money → string, dates → ISO, hide internal fields).

**Ports** — define interface + `Symbol` token in `infrastructure/<x>/<x>.port.ts`; bind the adapter in the infrastructure module; inject with `@Inject(TOKEN)`.

## Errors

- `common/errors/error-codes.ts` holds the `ErrorCode` enum (UPPER_SNAKE, prefixed by module: `ARTICLE_…`, `WORKFLOW_…`, `ADS_…`, `BILLING_…`).
- Throw `NotFoundError | ForbiddenError | ConflictError | ValidationError | InvalidStateTransitionError | PaymentRequiredError | RateLimitedError` — the global filter renders RFC 9457.

## Queues & jobs

- Queue names and job names are constants in `infrastructure/queue/queues.ts`. Job payloads are Zod-validated at the start of `process()`.
- Jobs must be **idempotent** (they can run twice). Use the entity status or a Redis `SET NX` key as the guard.
- Use `jobId` for de-duplication when an entity should have only one pending job (e.g. scheduled publish: `jobId = publish:{articleId}`).
- Cron jobs acquire a `LockService` lock named after the job.

## Security checklist for every endpoint

- [ ] `@Public()` only if truly public; otherwise `@RequirePermissions` present
- [ ] input validated by a contracts schema (params, query, body)
- [ ] ownership / state checked in a policy
- [ ] list queries scoped in the repository and paginated (max `pageSize` 100)
- [ ] privileged action has `@Audit(...)` or `AuditService.record()`
- [ ] rate limit considered (`@Throttle`) for auth, comments, AI runs, beacons
- [ ] response mapped through a mapper (no password hashes, tokens, internal notes leaking)

## Testing

- Unit: `src/modules/**/__tests__/*.spec.ts` — mock repositories/ports; test policies and transition tables exhaustively (table-driven tests).
- E2E: `test/e2e/<module>.e2e-spec.ts` — real Postgres (`DATABASE_URL` from `.env.test`, db `newsroom_test`) + Redis db 1; `test/helpers/reset-db.ts` truncates tables between files; `test/helpers/auth.ts` returns cookie + CSRF headers for a user with given roles; factories in `test/factories/*.factory.ts`.
- External ports are replaced with fakes in e2e (`FakeAiProvider`, `FakeGateway`, `InMemoryMail`, `FakeStorage`).
