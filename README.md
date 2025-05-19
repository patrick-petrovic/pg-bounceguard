# pg-bounceguard

`pg-bounceguard` is an npm module that acts as a wrapper around the `pg` module, allowing users to block or log Postgres
queries that may not work with [PGBouncer](https://github.com/pgbouncer/pgbouncer).

## Background

PGBouncer is a PostgreSQL connection pooler that usually runs with _transactional pooling_.
A client keeps its connection only for the duration of a transaction.
Hence, certain transaction-escaping statements can cause hard-to-debug issues.
For example, `CREATE TEMP TABLE` may unexpectedly leak the temporary table into subsequent transactions.
One of these transactions may then try to recreate the table even though it already exists.

`pg-bounceguard` allows you to wrap `pg` clients and pools to detect problematic queries.
Per default, problematic queries will throw an error.
You can also configure `pg-bounceguard` to log the queries instead.

> 🤓 **Note:** `pg-bounceguard` is a debugging tool. Recommended for use in development environments only.

## Features

- Blocks or logs Postgres queries that may cause issues with PGBouncer.
- Supports customization for handling specific statements using overrides.
- Offers the ability to sample queries and/or use a custom logging function.

## Installation

You can install the `pg-bounceguard` module via npm:

```bash
npm install pg-bounceguard
```

## Usage

Here's an example of how to use `pg-bounceguard` in your Node.js application:

```javascript
import { PGBounceGuard } from 'pg-bounceguard';
import { Client } from 'pg';

const unwrapped = new Client({
  // ... PostgreSQL connection details
});

const client = PGBounceGuard.wrap(unwrapped, {
  action: 'error',
  // ... other configurations
});

await client.connect();

// Usage example
await client.query('SELECT * FROM your_table'); // OK
await client.query('CREATE TEMP TABLE your_table (id INT)'); // Error!

await client.end();
```

## Configuration

### `PGBounceGuard.wrap`

- `action`: Action to take for queries that may not work with PGBouncer. Options: `'error'`, `'warn'`, or `'ignore'`.
  Default: `'error'`.
- `overrides`: Override `action` for specific query types.
- `logFn`: Custom logging function if `'warn'` is used.
- `sampleRate`: Number between 0 and 1 that determines the share of queries that are checked. Defaults to 1 (all queries
  are checked).

### Example Configuration

```javascript
// Example of custom configuration
const client = PGBounceGuard.wrap(unwrapped, {
  action: 'error',
  overrides: {
    createTempTable: 'ignore',
    set: 'warn',
  },
  logFn: (err) => {
    // Custom logging logic
  },
});
```

## Testing

To run integration tests (requires Docker):

```bash
npm run test:docker
```

Alternatively, you can spin up your own Postgres server on port 5432. Then, run `npm run test`.

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

This project is licensed under the [MIT License](LICENSE).
