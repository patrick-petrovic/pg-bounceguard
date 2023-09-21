import test from 'tape'

import { PGBounceGuard } from '../lib/pgBounceGuard'
import { Client } from 'pg'

test('errors', async (t) => {
  const testCases = [
    {
      query: 'select * from generate_series(1, 1)',
      error: null
    },
    {
      query: 'SET lock_timeout TO \'2s\'',
      error: 'SET/RESET statement'
    },
    {
      query: 'RESET lock_timeout',
      error: 'SET/RESET statement'
    },
    {
      query: 'SET LOCAL lock_timeout TO \'2s\'',
      error: null
    },
    {
      query: 'LISTEN foo',
      error: 'LISTEN statement'
    },
    {
      query: 'DECLARE test_cursor SCROLL CURSOR WITH HOLD FOR SELECT * FROM generate_series(1, 1000000)',
      error: 'CURSOR WITH HOLD statement'
    },
    {
      query: 'DECLARE test_cursor SCROLL CURSOR FOR SELECT * FROM generate_series(1, 1000000)',
      error: 'DECLARE CURSOR can only be used in transaction blocks' // Postgres error.
    },
    {
      query: 'CREATE TEMP TABLE foo (id int)',
      error: 'CREATE TEMP TABLE statement'
    },
    {
      query: 'CREATE TEMP TABLE foo (id int) ON COMMIT DROP',
      error: null
    },
    {
      query: 'LOAD \'test\'',
      error: 'LOAD statement'
    },
    {
      query: 'SELECT pg_advisory_lock(1)',
      error: 'pg_advisory_lock call'
    },
    {
      query: 'SELECT * from foo where bar = pg_advisory_lock(1)',
      error: 'pg_advisory_lock call'
    },
    {
      query: 'SELECT pg_advisory_xact_lock(1)',
      error: null
    }
  ]

  const unwrapped = new Client({
    host: 'localhost',
    port: 5433,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  })
  const client = PGBounceGuard.wrap(unwrapped, { action: 'error' })
  await client.connect()
  t.teardown(() => client.end())

  for (const testCase of testCases) {
    t.test(testCase.query, async (t) => {
      try {
        await client.query(testCase.query)
        if (testCase.error) {
          t.fail(`expected error for query: ${testCase.query}`)
        }
      } catch (err: any) {
        if (testCase.error) {
          t.ok(err.message.includes(testCase.error))
        } else {
          t.fail(`did not expect error for query: ${testCase.query}`)
        }
      }
    })
  }
})
