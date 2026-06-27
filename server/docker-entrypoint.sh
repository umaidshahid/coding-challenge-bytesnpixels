#!/bin/sh
set -e

# Seed the database on first boot only. Re-seeding drops all tables, so we
# never do it automatically once the volume holds a database.
if [ ! -f "$PULSE_DB_PATH" ]; then
  echo "No database at $PULSE_DB_PATH — seeding initial data."
  npm run seed
else
  echo "Database found at $PULSE_DB_PATH — skipping seed."
fi

exec "$@"
