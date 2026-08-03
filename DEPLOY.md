# Deploying ForkStack

Production is deployed by GitHub Actions on push to `main`
(`.github/workflows/deploy.yml`). **Backend first, then frontend, from the same
commit** — deploying them separately is what broke production in August 2026,
when the React + Clerk frontend went live against a backend that still expected
the old homegrown JWTs.

| Piece | Where it lives | Deployed by |
| --- | --- | --- |
| Backend (Lambda, API Gateway, DynamoDB, photo bucket) | `AppStack` | `npx cdk deploy AppStack` in CI |
| Frontend | `gh-pages` branch, served at `/ForkStack/` | `peaceiris/actions-gh-pages` in CI |

## One-time AWS setup (required before the first CI deploy)

CI authenticates with **GitHub OIDC** — no access keys are stored anywhere. Run
this once, with credentials that can create IAM resources:

```bash
ACCOUNT=963182642410
REPO=Issamna/ForkStack

# 1. Trust GitHub's OIDC issuer (skip if it already exists in the account).
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 2. A role only this repo's main branch may assume.
cat > /tmp/trust.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::${ACCOUNT}:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:${REPO}:ref:refs/heads/main" }
    }
  }]
}
JSON

aws iam create-role --role-name ForkStackDeploy \
  --assume-role-policy-document file:///tmp/trust.json

# 3. CDK assumes its own bootstrap roles, so the deploy role only needs to be
#    allowed to assume them. This is narrower than giving it admin.
aws iam put-role-policy --role-name ForkStackDeploy \
  --policy-name AssumeCdkBootstrapRoles \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::'"${ACCOUNT}"':role/cdk-hnb659fds-*"
    }]
  }'
```

Then add the role ARN as a **repository variable** (Settings → Secrets and
variables → Actions → Variables), named `AWS_DEPLOY_ROLE_ARN`:

```
arn:aws:iam::963182642410:role/ForkStackDeploy
```

Until that variable is set, the backend job fails and — because the frontend job
`needs: backend` — the frontend won't deploy either. That is deliberate: a
frontend deploy without its matching backend is the failure mode this pipeline
exists to prevent.

## Deploying by hand

Only if CI is unavailable. Both, from the same commit:

```bash
npx cdk deploy AppStack        # backend
cd web && npm run build && ...  # or just let CI do the frontend
```

## Things that bite

- **`cdk deploy` needs Docker** — `PythonFunction` bundles the Lambda in a
  container. GitHub runners have it.
- **Every DynamoDB table must be `PAY_PER_REQUEST`.** CDK's default is
  provisioned 5+5 per table, which bills 24/7 whether or not anything reads it,
  and five tables at that default sit exactly on the always-free ceiling.
- **`UserTable` has no RETAIN policy.** It is gone from the current stack; a
  pre-cutover backup is kept at
  `UserTable-pre-clerk-cutover-2026-08-03`.
- **Mock auth must never build.** `VITE_AUTH_MODE` is unset in the deploy
  workflow, so production compiles the real Clerk implementation in.
