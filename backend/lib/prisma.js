/**
 * Prisma Client Singleton (Neon PostgreSQL)
 *
 * Exported as a singleton so the whole app shares one Prisma client
 * (and therefore one connection pool). The Database adapter in
 * lib/database.js swaps this same client into transactions.
 *
 * Environment: DATABASE_URL must be a Neon (or any PostgreSQL) URL,
 * e.g. postgresql://user:password@ep-xxx.aws.neon.tech/dbname?sslmode=require
 */

const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  // Production — a single long-lived client
  prisma = new PrismaClient();
} else {
  // Dev/test — reuse across hot reloads to avoid exhausting connections
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

module.exports = prisma;