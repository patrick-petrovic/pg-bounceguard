import test from 'tape'
import { PGBounceGuard } from '../lib/pgBounceGuard'
import { Client } from 'pg'
import type { PGBounceGuardError } from "../lib/error";

test('config options', async (t) => {
  const unwrapped = new Client({
    host: 'localhost',
    port: 5433,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  })

  let lastError: PGBounceGuardError | null = null
  const client = PGBounceGuard.wrap(unwrapped, {
    action: 'error',
    overrides: {
      createTempTable: 'ignore',
      set: 'warn',
    },
    logFn: (err) => {
      lastError = err
    }
  })

  await client.connect()
  t.teardown(() => client.end())

  t.test('should ignore create temp table', async (t) => {
    await client.query('CREATE TEMP TABLE foo (id int)')
    t.equal(lastError, null)
  })

  t.test('should warn on set', async (t) => {
    await client.query('SET statement_timeout = \'30s\'')
    t.ok(lastError?.message.includes('SET statement'))
  })
})
