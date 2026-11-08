import postgres from 'npm:postgres@3.4.8';
import { AsyncLocalStorage } from 'node:async_hooks';

export const pool = postgres(Deno.env.get('SUPABASE_DB_URL')!, {
  prepare: false, max: 3, idle_timeout: 20,
  connection: { application_name: 'gestalt-api', options: '-c search_path=gestalt,public' },
  types: { bigint: { to: 20, from: [20], serialize: String, parse: Number } }
});
const context = new AsyncLocalStorage<any>();
export const connection = () => context.getStore() || pool;

export function translate(sql: string): string {
  sql = sql.replace(/GROUP_CONCAT\(/gi, 'STRING_AGG(')
    .replace(/comments_enabled = NOT comments_enabled/gi, 'comments_enabled = 1 - comments_enabled')

    .replace(/GROUP BY t\.id(?!,)/g, 'GROUP BY t.id, u.id')
    .replace(/COALESCE\(last_post_at, t\.created_at\)/g, "COALESCE(MAX(CASE WHEN c.status = 'approved' THEN c.created_at END), t.created_at)");
  if(/JOIN volumes v/.test(sql))sql=sql.replace(/GROUP BY a\.id(?!,)/g, 'GROUP BY a.id, v.id');
  const ignore = /INSERT OR IGNORE/i.test(sql);
  sql = sql.replace(/INSERT OR IGNORE/gi, 'INSERT');
  if(ignore && !/ON CONFLICT/i.test(sql))sql += ' ON CONFLICT DO NOTHING';
  let index = 0;
  // Replace bound parameters while preserving quoted SQL strings.
  return sql.replace(/'(?:''|[^'])*'|\?/g, token => token === '?' ? `$${++index}` : token);
}

export const sqlite = {
  prepare(sql: string) {
    const query = translate(sql);
    const execute = (args: unknown[]) => connection().unsafe(query, args.map(v => v === undefined ? null : v));
    return {
      async all(...args: unknown[]) { return Array.from(await execute(args)); },
      async get(...args: unknown[]) { return (await execute(args))[0]; },
      async run(...args: unknown[]) {
        const insert = /^\s*INSERT\b/i.test(query);
        const rows = await connection().unsafe(insert ? `${query.trim().replace(/;$/, '')} RETURNING *` : query, args.map(v => v === undefined ? null : v));
        return { changes: rows.count, lastInsertRowid: rows[0]?.id };
      }
    };
  },
  transaction<T>(fn: () => Promise<T>) {
    return async () => context.getStore() ? fn() : pool.begin(sql => context.run(sql, fn));
  }
};
