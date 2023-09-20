import {PGBounceGuard} from '../lib/pgBounceGuard'
import {Client} from 'pg'

/*
const bg = new PGBounceGuard();

bg.checkQuery('SET lock_timeout TO \'2s\'')

bg.checkQuery('SET LOCAL lock_timeout TO \'2s\'')*/

/* bg.checkQuery({
  name: 'get-user',
  text: 'SELECT * FROM users WHERE id = $1',
}) */

(async () => {
  const unwrapped = new Client({
    host: 'localhost',
    port: 5432,
    database: 'demo',
    user: 'postgres',
    password: '',
  })
  const client = PGBounceGuard.wrap(unwrapped, {action: 'error'})
  await client.connect()
  /*await client.query('SET lock_timeout TO \'2s\'')
  await client.query({
    name: 'get-name',
    text: 'SELECT $1::text',
    values: ['brianc'],
    rowMode: 'array',
  })*/
  //await client.query(`NOTIFY test, 'hello'`)
  // await client.query('DECLARE lol SCROLL  CURSOR WITH HOLD FOR SELECT * FROM generate_series(1, 1000000)')
  //await client.query('DECLARE lol SCROLL CURSOR WITHOUT HOLD FOR SELECT * FROM generate_series(1, 1000000)')

  await client.query(`select pg_advisory_xact_lock(1)`)

  await client.end()
})()
