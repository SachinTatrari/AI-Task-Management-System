# Day 18 – Docker Build Cache, Layer Caching, BuildKit & CI Optimizations

## Objective

Today I learned how Docker makes builds fast.

Initially I believed that every `docker build` starts from scratch.

Instead, I learned that Docker intelligently reuses previously built layers whenever possible.

This is known as **Docker Build Cache**.

I also learned why Dockerfile instruction order matters, how BuildKit improves build performance, why GitHub runners don't reuse Docker cache, and why CI pipelines use `npm ci` instead of `npm install`.

---

# Why Docker Needs Build Cache

Imagine a simple Dockerfile.

```dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]
```

During the first build Docker executes every instruction.

```
FROM node:20
        ↓
WORKDIR /app
        ↓
COPY package.json
        ↓
RUN npm install
        ↓
COPY . .
        ↓
CMD
```

This is expected because Docker has never built this image before.

---

# What Happens During The Second Build?

Suppose only:

```
server.js
```

changes.

Nothing else.

Specifically,

- package.json ❌
- package-lock.json ❌
- Dockerfile ❌

Only application code changes.

Question:

Should Docker execute:

```
RUN npm install
```

again?

The answer is:

**No.**

Docker already knows that package.json has not changed.

Therefore dependencies remain the same.

Reinstalling packages would waste:

- CPU
- Memory
- Time
- Network bandwidth

Instead Docker reuses the previous result.

---

# Docker Does Not Cache Files

One of today's biggest learnings:

Initially I thought Docker caches files.

Actually Docker caches the **result of every Dockerfile instruction**.

Example:

```
Instruction

↓

Result Layer

↓

Stored
```

For every instruction Docker stores the resulting filesystem layer.

Example:

```
FROM node:20

↓

Layer A
```

```
WORKDIR /app

↓

Layer B
```

```
COPY package.json

↓

Layer C
```

```
RUN npm install

↓

Layer D
```

Every instruction creates one layer.

---

# Cache Hit vs Cache Miss

For every instruction Docker asks:

> Have I already executed this instruction with exactly the same inputs?

If yes:

```
Cache Hit
```

Reuse previous layer.

If no:

```
Cache Miss
```

Execute instruction again.

---

# Sequential Cache

One of the most important Docker concepts.

Docker cache is sequential.

Example:

```
FROM
↓

WORKDIR
↓

COPY package.json
↓

RUN npm install
↓

COPY . .
```

Suppose only:

```
server.js
```

changes.

Docker evaluates every instruction.

```
FROM
```

Cache Hit

↓

```
WORKDIR
```

Cache Hit

↓

```
COPY package.json
```

Cache Hit

↓

```
RUN npm install
```

Cache Hit

↓

```
COPY . .
```

Cache Miss

because application source changed.

Once Docker encounters a Cache Miss:

Everything after that instruction must be rebuilt.

This rule explains why Dockerfile instruction order is extremely important.

---

# Good Dockerfile

```
COPY package.json

↓

RUN npm install

↓

COPY source code
```

Why?

Because package.json changes rarely.

Application code changes frequently.

As long as package.json remains unchanged Docker skips npm install.

Result:

Very fast builds.

---

# Bad Dockerfile

```
COPY . .

↓

RUN npm install
```

Now changing:

```
server.js
```

changes the COPY layer.

That immediately invalidates:

```
RUN npm install
```

So Docker unnecessarily reinstalls every dependency.

Result:

Slow builds.

---

# Golden Rule

Always copy files that change less frequently before files that change often.

Example:

```
Stable Files

↓

Expensive Operations

↓

Frequently Changing Files
```

This maximizes cache reuse.

---

# Where Does Docker Store Cache?

Initially I thought Docker might create something like:

```
project/

.docker/
```

Actually Docker does not store cache inside the project.

Docker Engine manages cache globally.

```
Docker Engine

├── Images
├── Layers
├── Build Cache
├── Containers
├── Networks
└── Volumes
```

The cache belongs to Docker Engine.

Not the project.

This allows multiple projects to reuse the same base image.

Example:

```
Project A

FROM node:20

↓

Shared Layer
```

```
Project B

FROM node:20

↓

Same Shared Layer
```

Docker downloads node:20 only once.

---

# Why GitHub Actions Cannot Reuse Docker Cache

GitHub runners are ephemeral.

Example:

```
Runner 1

↓

Docker Build

↓

Runner Destroyed
```

Next workflow:

```
Runner 2

↓

Fresh Machine
```

Runner 2 starts with:

- No Images
- No Containers
- No Build Cache
- No Volumes

Everything is fresh.

Therefore Docker cache created during one workflow is unavailable in the next workflow.

Professional CI systems solve this using remote cache, which will be covered later.

---

# Can Parallel Workflows Share Docker Cache?

Today I also asked:

Can two GitHub workflows share the same runner?

Answer:

Normally no.

Each workflow receives its own isolated virtual machine.

```
Workflow A

↓

Runner A
```

```
Workflow B

↓

Runner B
```

Each runner has:

- Independent filesystem
- Independent Docker Engine
- Independent memory
- Independent cache

They cannot directly share Docker layers.

If workflows need to exchange information they use:

- Artifacts
- Cache
- Container Registry
- External Storage

instead of sharing runners.

---

# How Docker Decides Cache Hits

Docker does not compare files manually every build.

Instead Docker creates a fingerprint.

Conceptually:

```
Instruction

+

Input Files

↓

Hash

↓

Layer
```

During the next build Docker computes the fingerprint again.

If hashes match:

```
Cache Hit
```

Reuse previous layer.

If hashes differ:

```
Cache Miss
```

Execute again.

This is similar to Git commits.

Git stores:

```
Commit SHA
```

Docker stores:

```
Layer Fingerprints

Image Digests
```

Both use hashing.

---

# BuildKit

Modern Docker no longer uses the old builder.

Instead it uses BuildKit.

When GitHub Actions executed:

```
docker/build-push-action
```

internally it actually executed:

```
docker buildx build
```

not

```
docker build
```

BuildKit provides:

- Better caching
- Smarter dependency tracking
- Parallel execution
- Multi-stage optimization
- Remote cache support
- Secrets during build
- Multi-platform builds
- Better logging

BuildKit's goal is not simply to build.

Its goal is to avoid unnecessary work.

---

# Dependency Tracking

BuildKit understands what every instruction depends on.

Example:

```
RUN npm install
```

depends on:

```
package.json

package-lock.json
```

It does NOT depend on:

```
README.md

server.js
```

This allows smarter cache reuse.

---

# .dockerignore

Suppose project contains:

```
README.md
.git
node_modules
```

If these files are copied into the build context they affect cache.

Instead create:

```
.dockerignore
```

Example:

```
README.md
.git
node_modules
.vscode
```

Now Docker ignores unnecessary files.

Benefits:

- Smaller build context
- Faster uploads
- Better cache reuse
- Faster builds

---

# Why Build Speed Matters

Build speed is not just a technical issue.

It directly affects business.

## Developer Productivity

Slow builds mean developers spend more time waiting.

```
Code

↓

Wait

↓

Feedback
```

instead of

```
Code

↓

Immediate Feedback
```

Fast feedback improves productivity.

---

## Infrastructure Cost

CI platforms charge for runner time.

Faster builds consume fewer runner minutes.

Result:

Lower infrastructure cost.

---

## Production Incident Recovery

Imagine production fails.

```
Bug

↓

Fix

↓

CI Build

↓

Deploy
```

A faster build means production recovers sooner.

Less downtime.

Less business loss.

---

## Frequent Deployments

Fast pipelines encourage:

- Smaller commits
- More deployments
- Better software quality

Slow pipelines encourage large risky deployments.

---

# npm install vs npm ci

One of today's important CI concepts.

During development we commonly use:

```
npm install
```

It may:

- Update dependencies
- Modify package-lock.json
- Resolve newer compatible versions

In CI we use:

```
npm ci
```

The word:

```
ci

↓

Continuous Integration
```

npm ci:

- Uses package-lock.json exactly
- Never updates dependency versions
- Deletes node_modules first
- Performs a clean install
- Produces deterministic builds

Every machine installs exactly the same dependency versions.

Example:

Developer Laptop

↓

Express 5.0.1

CI Runner

↓

Express 5.0.1

Production

↓

Express 5.0.1

This eliminates "works on my machine" problems.

---

# Key Learnings

- Docker caches instruction results instead of files.
- Every Dockerfile instruction creates a layer.
- Docker evaluates cache instruction-by-instruction.
- Cache is sequential.
- Cache Miss invalidates all following instructions.
- Dockerfile instruction order directly affects build speed.
- Stable files should be copied before frequently changing files.
- Docker cache belongs to Docker Engine, not the project.
- GitHub runners are ephemeral, so local Docker cache is lost after each workflow.
- BuildKit is Docker's modern build engine.
- BuildKit performs smarter dependency analysis and caching.
- .dockerignore reduces unnecessary cache invalidation.
- Faster builds improve developer productivity, reduce infrastructure cost, and shorten production recovery time.
- CI pipelines prefer npm ci because it guarantees deterministic dependency installation.

---

# Biggest Takeaway

Today I realized that Docker's performance is not accidental.

It is the result of intelligent layer caching, hashing, dependency tracking, and BuildKit optimizations.

A well-designed Dockerfile can reduce build times dramatically simply by maximizing cache reuse.

This understanding is essential for building efficient CI/CD pipelines and production-ready containerized applications.