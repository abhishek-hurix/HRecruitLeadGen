#!/usr/bin/env bash
set -euo pipefail
cd ~/HRecruitLeadGen

echo "== Create dedicated test database (safe; not prod hurix_talent) =="
EXISTS=$(sudo docker exec hrecruitleadgen-postgres-1 \
  psql -U hurix -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='hurix_talent_test'")
if [ "$EXISTS" != "1" ]; then
  sudo docker exec hrecruitleadgen-postgres-1 \
    psql -U hurix -d postgres -c "CREATE DATABASE hurix_talent_test;"
  echo "Created hurix_talent_test"
else
  echo "hurix_talent_test already exists"
fi

get_env() {
  local key="$1"
  # Read KEY=value from .env without sourcing (avoids broken unquoted emails/spaces)
  grep -E "^${key}=" .env | head -n1 | cut -d= -f2-
}

DATABASE_URL="$(get_env DATABASE_URL)"
SUPABASE_URL="$(get_env SUPABASE_URL)"
SUPABASE_ANON_KEY="$(get_env SUPABASE_ANON_KEY)"
SUPABASE_SERVICE_ROLE_KEY="$(get_env SUPABASE_SERVICE_ROLE_KEY)"
JWT_ASSESSMENT_SECRET="$(get_env JWT_ASSESSMENT_SECRET)"
JWT_ADMIN_SECRET="$(get_env JWT_ADMIN_SECRET)"
FRONTEND_URL="$(get_env FRONTEND_URL)"
APP_URL="$(get_env APP_URL)"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL missing in .env" >&2
  exit 1
fi

TEST_URL=$(printf '%s' "$DATABASE_URL" | sed 's#/hurix_talent#/hurix_talent_test#')

ENVFILE=/tmp/hurix-test.env
cat > "$ENVFILE" <<EOF
NODE_ENV=test
DATABASE_URL=${TEST_URL}
TEST_DATABASE_URL=${TEST_URL}
JWT_ASSESSMENT_SECRET=${JWT_ASSESSMENT_SECRET:-test-assessment-secret-min-32-chars!!}
JWT_ADMIN_SECRET=${JWT_ADMIN_SECRET:-test-admin-secret-min-32-chars!!!!!!}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
FRONTEND_URL=${FRONTEND_URL:-http://3.90.33.48}
APP_URL=${APP_URL:-http://3.90.33.48}
EMAIL_MOCK_MODE=true
ADMIN_EMAIL=admin@hurixdigital.com
ADMIN_PASSWORD=HurixAdmin@2026
EOF

echo "TEST_DATABASE_URL host/db (redacted): $(printf '%s' "$TEST_URL" | sed -E 's#://[^:]+:[^@]+@#://****:****@#')"
echo "SUPABASE_URL=${SUPABASE_URL}"

echo "== Using existing backend checkout on EC2 =="
git rev-parse --short HEAD || true

echo "== Run Vitest in disposable Node container on same Docker network =="
sudo docker run --rm \
  --name hurix-qa-runner \
  --network hrecruitleadgen_hurix-network \
  --env-file "$ENVFILE" \
  -v "$HOME/HRecruitLeadGen/backend:/app" \
  -w /app \
  node:20-bookworm-slim \
  bash -lc '
    set -e
    apt-get update -qq
    apt-get install -y -qq openssl ca-certificates >/dev/null
    npm ci
    npx prisma generate
    npx prisma migrate deploy
    npx prisma db seed || npm run prisma:seed || true
    echo "===== UNIT ====="
    set +e
    npm run test:unit
    UNIT_FAIL=$?
    echo "===== SECURITY ====="
    npm run test:security
    SEC_FAIL=$?
    echo "===== INTEGRATION ====="
    npm run test:integration
    INT_FAIL=$?
    echo "===== SUMMARY ====="
    echo "UNIT_EXIT=$UNIT_FAIL SEC_EXIT=$SEC_FAIL INT_EXIT=$INT_FAIL"
    if [ "$UNIT_FAIL" -ne 0 ] || [ "$SEC_FAIL" -ne 0 ] || [ "$INT_FAIL" -ne 0 ]; then
      exit 1
    fi
  '

STATUS=$?
rm -f "$ENVFILE"
exit $STATUS
