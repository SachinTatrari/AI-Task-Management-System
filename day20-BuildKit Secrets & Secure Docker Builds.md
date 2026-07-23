# Day 20 - BuildKit Secrets & Secure Docker Builds

## Objective

Today's goal was to understand how Docker securely handles sensitive information during image builds.

By the end of this session, I understood:

- Why BuildKit Secrets exist.
- Why `ENV` and `COPY` are insecure for secrets.
- How BuildKit mounts secrets temporarily.
- How GitHub Actions securely passes secrets to BuildKit.
- Difference between Build-time Secrets and Runtime Secrets.
- Security principle of Least Privilege.

---

# The Problem

Suppose my application needs to install packages from a private npm registry.

```
Private Registry

↓

Authentication Required

↓

npm ci
```

Without authentication, the build fails.

Initially, developers used methods like:

```dockerfile
ENV NPM_TOKEN=xxxxxxxx
```

or

```dockerfile
COPY .npmrc .
```

Both approaches expose secrets.

---

# Why ENV is Insecure

Example:

```dockerfile
FROM node:20

ENV NPM_TOKEN=abc123

RUN npm ci

RUN unset NPM_TOKEN
```

Docker creates layers:

```
Layer 1

FROM node:20

↓

Layer 2

ENV NPM_TOKEN=abc123

↓

Layer 3

RUN npm ci

↓

Layer 4

RUN unset NPM_TOKEN
```

Although the last layer removes the variable, Layer 2 still contains the secret forever.

Docker images are immutable.

Deleting something in a later layer does not remove it from previous layers.

---

# Why COPY is Also Insecure

Example:

```dockerfile
COPY .npmrc .

RUN npm ci

RUN rm .npmrc
```

Even though `.npmrc` is deleted later, it already exists inside an earlier image layer.

Therefore, secrets remain recoverable.

---

# BuildKit Solution

Instead of storing secrets inside image layers,

BuildKit temporarily mounts them only while a specific `RUN` instruction executes.

```
Secret

↓

Temporary Mount

↓

RUN Instruction

↓

Secret Removed
```

Nothing gets committed into image layers.

---

# Providing Secrets During Build

Secrets are supplied when running the build.

Example:

```bash
docker build \
  --secret id=npm_token,src=npm_token.txt \
  -t my-app .
```

Meaning:

| Part | Description |
|------|-------------|
| `--secret` | Pass a secret to BuildKit |
| `id=npm_token` | Secret identifier |
| `src=npm_token.txt` | File containing the actual secret |

Important:

The Dockerfile never contains the actual secret.

It only requests the secret by its ID.

---

# Using Secrets Inside Dockerfile

Example:

```dockerfile
RUN --mount=type=secret,id=npm_token \
    sh -c 'cat /run/secrets/npm_token'
```

Explanation:

- `RUN` executes a command.
- `--mount=type=secret` temporarily mounts a secret.
- `id=npm_token` tells BuildKit which secret to mount.
- Secret becomes available at:

```
/run/secrets/npm_token
```

---

# Secret Lifecycle

```
Host Machine

↓

docker build --secret

↓

BuildKit

↓

Temporary Secret Mount

↓

RUN executes

↓

RUN completes

↓

Secret Removed
```

The secret only exists during that single `RUN` instruction.

---

# Multiple RUN Instructions

Example:

```dockerfile
RUN --mount=type=secret,id=db_password \
    migrate-db

RUN build-app
```

Question:

Can the second RUN access the database password?

Answer:

No.

Each `RUN` instruction gets its own isolated environment.

The secret is removed immediately after the first RUN finishes.

If another RUN requires the secret, it must mount it again.

---

# Multiple Secrets

A single RUN instruction can mount multiple secrets.

Example:

```dockerfile
RUN --mount=type=secret,id=db_password \
    --mount=type=secret,id=api_key \
    sh -c 'echo "Using multiple secrets"'
```

BuildKit only exposes the secrets explicitly requested by that command.

---

# Principle of Least Privilege

BuildKit follows the security principle:

> Give only the required secrets,
> only to the required process,
> only for the required amount of time.

This minimizes accidental exposure.

---

# GitHub Actions Integration

Secrets should never be stored inside Git.

Instead they are stored as GitHub Secrets.

```
Repository Settings

↓

Secrets and Variables

↓

Actions

↓

NPM_TOKEN
```

Workflow:

```yaml
- name: Build Docker Image
  uses: docker/build-push-action@v6

  with:
    push: true

    tags: sachin3586/ai-task-management-system-image:latest

    secrets: |
      npm_token=${{ secrets.NPM_TOKEN }}
```

Meaning:

```
GitHub Secret

↓

Workflow

↓

BuildKit Secret

↓

Dockerfile
```

Dockerfile:

```dockerfile
RUN --mount=type=secret,id=npm_token \
    sh -c '
      export NPM_TOKEN=$(cat /run/secrets/npm_token)
      npm ci
    '
```

The secret never becomes part of the Docker image.

---

# Build-Time vs Runtime Secrets

## Build-Time Secrets

Needed while building the image.

Examples:

- Private npm token
- Git authentication token
- Private package registry credentials
- License keys for downloading SDKs

These are ideal for BuildKit Secrets.

---

## Runtime Secrets

Needed after the container starts.

Examples:

- Database password
- MongoDB URI
- Redis password
- JWT secret
- AWS credentials
- API keys

These should NOT use BuildKit Secrets.

Instead they are supplied by:

- Kubernetes Secrets
- AWS Secrets Manager
- Docker runtime environment variables
- HashiCorp Vault
- Azure Key Vault

---

# Why BuildKit Secrets Cannot Be Used in Production Runtime

BuildKit Secrets disappear immediately after the image build.

Production applications require secrets while they are running.

Example:

```
docker build

↓

Image Created

↓

BuildKit Secret Removed

↓

docker run

↓

Application Starts
```

At runtime, the application no longer has access to BuildKit Secrets.

---

# Real Project Example

Suppose my Node.js application needs to install dependencies from a private npm registry.

During build:

```dockerfile
RUN --mount=type=secret,id=npm_token \
    sh -c '
      export NPM_TOKEN=$(cat /run/secrets/npm_token)
      npm ci
    '
```

Later, when the application starts:

```javascript
mongoose.connect(process.env.MONGO_URI);
```

MongoDB credentials are runtime secrets.

They must be provided after the container starts.

---

# Interview Questions

## Why not use ENV for secrets?

Because ENV becomes part of image layers and image history.

---

## Why not COPY a secret file?

Because copied files are stored inside image layers even if deleted later.

---

## Why are BuildKit Secrets secure?

Because they are temporarily mounted during a specific RUN instruction and are never committed to image layers or build cache.

---

## Where is a BuildKit Secret available?

Only during a specific RUN instruction.

Usually mounted at:

```
/run/secrets/<secret-id>
```

---

## Why can't BuildKit Secrets provide database passwords in production?

Because BuildKit Secrets are build-time secrets.

Database passwords are runtime secrets.

They should be provided after the container starts using runtime secret management systems.

---

# Key Learnings

- Never store secrets inside Dockerfiles.
- Never COPY secret files into Docker images.
- Docker image layers are immutable.
- BuildKit Secrets are temporary.
- Every RUN instruction has its own isolated secret mount.
- A RUN instruction can mount multiple secrets.
- BuildKit follows the Principle of Least Privilege.
- GitHub Secrets integrate securely with BuildKit.
- Build-time secrets and Runtime secrets solve different problems.
- Runtime applications should use Kubernetes Secrets, AWS Secrets Manager, Vault, or similar secret management systems.