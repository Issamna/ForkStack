#!/usr/bin/env bash
# Run ForkStack fully locally, with no AWS account and no Clerk instance.
#
#   ./dev-local.sh            # mock AWS + API with mock auth, seeded
#   ./dev-local.sh --no-seed  # same, but leave the database empty
#
# Then, in another terminal:  cd web && npm run dev
#
# Two things are mocked, both deliberately unreachable from production:
#   * AWS  -- moto server stands in for DynamoDB and S3. Nothing here can touch
#             the real account: the endpoint is localhost and the credentials
#             are fake.
#   * Auth -- the API is served from `local_app`, which overrides the Clerk
#             dependency. The Lambda entrypoint is `api.handler`, and nothing in
#             its import graph reaches `local_app`, so this cannot ship.
#
# Table names are set explicitly because the service defaults disagree with each
# other (recipe_service defaults to "RecipesTable", the rest to singular names).
set -euo pipefail

cd "$(dirname "$0")"

MOCK_PORT="${MOCK_PORT:-5001}"
API_PORT="${API_PORT:-8000}"
WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:5173}"
export MOCK_USER_ID="${MOCK_USER_ID:-user_local_dev}"

# shellcheck disable=SC1091
source .venv/bin/activate 2>/dev/null || true

# Fake credentials: moto accepts anything, and real ones must never be picked up
# from the environment or ~/.aws by mistake.
export AWS_ENDPOINT_URL="http://localhost:$MOCK_PORT"
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
export AWS_SESSION_TOKEN=local
export AWS_DEFAULT_REGION=us-east-1

export RECIPE_TABLE=RecipeTable
export RECIPE_TAG_TABLE=RecipeTagTable
export INGREDIENT_TABLE=IngredientTable
export MEAL_PLAN_TABLE=MealPlanTable
export SHOPPING_LIST_TABLE=ShoppingListTable
export RECIPE_PHOTO_BUCKET="${RECIPE_PHOTO_BUCKET:-forkstack-photos-local}"
export ALLOWED_ORIGINS="$WEB_ORIGIN"
# Unused under mock auth, but set so the app boots identically to production.
export CLERK_ISSUER=https://mint-chow-13.clerk.accounts.dev
export CLERK_AUTHORIZED_PARTIES="$WEB_ORIGIN"

if ! curl -sf -m 2 "http://localhost:$MOCK_PORT" >/dev/null 2>&1; then
  echo "starting mock AWS (moto) on :$MOCK_PORT"
  moto_server -p "$MOCK_PORT" >/tmp/forkstack-moto.log 2>&1 &
  for _ in $(seq 1 40); do
    curl -sf -m 1 "http://localhost:$MOCK_PORT" >/dev/null 2>&1 && break
    sleep 0.25
  done
else
  echo "mock AWS already running on :$MOCK_PORT"
fi

if [ "${1:-}" != "--no-seed" ]; then
  python src/scripts/seed_local.py --owner "$MOCK_USER_ID" --reset
fi

echo
echo "  API        http://localhost:$API_PORT   (mock auth as $MOCK_USER_ID)"
echo "  frontend   $WEB_ORIGIN  -- run: cd web && npm run dev"
echo
cd src
exec uvicorn local_app:app --port "$API_PORT" --reload
