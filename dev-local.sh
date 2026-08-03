#!/usr/bin/env bash
# Run ForkStack fully locally: DynamoDB Local in Docker + the FastAPI backend.
#
# Nothing here touches AWS. The API is pointed at DynamoDB Local through
# AWS_ENDPOINT_URL_DYNAMODB, and the table names are set explicitly -- the
# service defaults disagree with each other (recipe_service defaults to
# "RecipesTable", the rest to singular), so relying on them would half-work.
#
#   ./dev-local.sh                 # start the database and the API on :8000
#   ./dev-local.sh --seed user_xxx # also seed dummy data for that Clerk user
#
# The frontend already points at http://localhost:8000 via web/.env, so:
#   cd web && npm run dev
set -euo pipefail

cd "$(dirname "$0")"

DDB_PORT=8001
API_PORT=8000
CONTAINER=forkstack-ddb-local

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  echo "starting DynamoDB Local on :$DDB_PORT"
  # -inMemory: the database is a scratchpad and is wiped when the container
  # stops, which is what you want for dummy data.
  docker run -d --name "$CONTAINER" -p "$DDB_PORT":8000 \
    amazon/dynamodb-local:latest \
    -jar DynamoDBLocal.jar -sharedDb -inMemory >/dev/null
  sleep 4
else
  echo "DynamoDB Local already running on :$DDB_PORT"
fi

# shellcheck disable=SC1091
source .venv/bin/activate 2>/dev/null || true

export AWS_ENDPOINT_URL_DYNAMODB="http://localhost:$DDB_PORT"
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
export AWS_DEFAULT_REGION=us-east-1
export RECIPE_TABLE=RecipeTable
export RECIPE_TAG_TABLE=RecipeTagTable
export INGREDIENT_TABLE=IngredientTable
export MEAL_PLAN_TABLE=MealPlanTable
export SHOPPING_LIST_TABLE=ShoppingListTable
# Real Clerk verification, against the dev instance -- localhost is allowed.
# WEB_ORIGIN must match the port Vite actually serves on: the backend checks it
# for CORS *and* as the token's authorized party, so a mismatch fails every
# request after an otherwise successful login.
WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:5173}"
export CLERK_ISSUER=https://mint-chow-13.clerk.accounts.dev
export CLERK_AUTHORIZED_PARTIES="$WEB_ORIGIN"
export ALLOWED_ORIGINS="$WEB_ORIGIN"
echo "accepting requests from $WEB_ORIGIN  (override with WEB_ORIGIN=...)"

if [ "${1:-}" = "--seed" ]; then
  if [ -z "${2:-}" ]; then
    echo "usage: ./dev-local.sh --seed <clerk-user-id>" >&2
    echo "find it with window.Clerk.user.id in the browser console" >&2
    exit 1
  fi
  python src/scripts/seed_local.py --owner "$2" --reset
fi

echo "API on http://localhost:$API_PORT  (ctrl-c to stop)"
cd src
exec uvicorn api:app --port "$API_PORT" --reload
