// Bridge: Re-exporting from modern PostgreSQL implementation
export { pool, initDb, rawPgPool, translateQuery } from './postgres.js';
export type { DbConnection } from './postgres.js';
