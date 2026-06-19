#!/bin/bash
set -e
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump $DATABASE_URL > "$BACKUP_DIR/hurix_talent_$TIMESTAMP.sql"
echo "Backup saved to $BACKUP_DIR/hurix_talent_$TIMESTAMP.sql"
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
