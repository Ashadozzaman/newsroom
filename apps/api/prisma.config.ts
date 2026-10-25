// Prisma 7 CLI configuration (migrate, generate, studio, seed).
// The runtime PrismaClient does NOT read this file — it gets the URL via the
// @prisma/adapter-pg driver adapter in src/infrastructure/database/prisma.service.ts.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
