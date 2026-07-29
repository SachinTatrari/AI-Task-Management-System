# Day 21 - Multi-stage Builds & .dockerignore

## Objective

Today's goal was to understand how professional Docker images are built using Multi-stage Builds and `.dockerignore`.

By the end of this session, I understood:

- Why Multi-stage Builds exist.
- The problems with single-stage Dockerfiles.
- How multiple `FROM` instructions create multiple build stages.
- How `COPY --from` works.
- Why Multi-stage Builds improve security and reduce image size.
- How `.dockerignore` reduces the Docker build context.
- How to build a production-ready Dockerfile for a Node.js application.

---

# Problem with Single-stage Builds

Consider the following Dockerfile:

```dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm","start"]
```

This works perfectly.

However, the final image contains everything required to build the application.

```
Final Image

├── Node Runtime
├── npm
├── Source Code
├── package.json
├── package-lock.json
├── node_modules
├── Development Dependencies
└── Build Tools
```

Many of these components are unnecessary in production.

---

# Factory Analogy

Imagine building a chair.

The factory uses:

- Saw
- Drill
- Hammer
- Paint
- Measuring Tape

When the chair is complete, the customer only needs the chair.

The factory should not be delivered with it.

Multi-stage Builds apply the same idea.

The builder stays behind.

Only the finished product is delivered.

---

# What is a Multi-stage Build?

A Multi-stage Build allows multiple build environments inside one Dockerfile.

Each stage begins with its own `FROM` instruction.

Example:

```dockerfile
FROM node:20 AS builder

...

FROM node:20-slim AS runtime
```

Every `FROM` starts a completely new filesystem.

Stages are independent.

---

# Build Flow

```
Stage 1 (Builder)

↓

Install Dependencies

↓

Build Application

↓

Create Runtime Files

↓

COPY --from

↓

Stage 2 (Runtime)

↓

Final Image
```

Only the final stage becomes the Docker image.

Previous stages remain intermediate build stages.

---

# Naming Build Stages

Stages can be named.

Example:

```dockerfile
FROM node:20 AS builder
```

Later:

```dockerfile
COPY --from=builder ...
```

This is easier to understand than:

```dockerfile
COPY --from=0
```

Although both are valid.

---

# COPY --from

Unlike:

```dockerfile
COPY . .
```

which copies files from the local build context,

```dockerfile
COPY --from=builder ...
```

copies files from another build stage.

Example:

```dockerfile
FROM node:20 AS builder

RUN touch hello.txt

FROM alpine

COPY --from=builder /hello.txt .
```

Here:

```
Builder Stage

↓

hello.txt

↓

Runtime Stage
```

The file is copied from the Builder stage's filesystem, not from the local machine.

---

# Copying from External Images

`COPY --from` can also copy from an existing Docker image.

Example:

```dockerfile
COPY --from=nginx:alpine /etc/nginx/nginx.conf .
```

Docker pulls the image (if required) and copies the requested file.

---

# Why Multi-stage Builds Improve Security

Production applications usually do not need:

- Jest
- ESLint
- Prettier
- Nodemon
- Test files
- Documentation

Keeping unnecessary software increases:

- Image size
- Attack surface
- Deployment time

Multi-stage Builds allow these tools to remain in the Builder stage.

Only runtime components are copied.

---

# Production Dependencies

Example package.json

```
Dependencies

- express
- mongoose

Dev Dependencies

- nodemon
- jest
- eslint
- prettier
```

Production images should contain:

```
✔ express
✔ mongoose
```

Development tools should remain outside the runtime image.

---

# Production Dockerfile

```dockerfile
# ============================
# Stage 1 - Builder
# ============================

FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# ============================
# Stage 2 - Runtime
# ============================

FROM node:20-slim AS runtime

WORKDIR /app

COPY --from=builder /app/package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/server.js ./
COPY --from=builder /app/app.js ./
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/models ./models
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/config ./config
COPY --from=builder /app/utils ./utils

EXPOSE 3000

CMD ["node","server.js"]
```

---

# Why npm ci Runs Twice

Builder Stage

```bash
npm ci
```

Installs:

- Production dependencies
- Development dependencies

Needed for:

- Tests
- Linting
- Building
- Code generation

Runtime Stage

```bash
npm ci --omit=dev
```

Installs only production dependencies.

This creates a much smaller production image.

---

# What is .dockerignore?

`.dockerignore` works similarly to `.gitignore`.

Before Docker starts building an image, it creates a Build Context.

Without `.dockerignore`, Docker sends every file inside the project directory to the Docker daemon.

This includes unnecessary files like:

- .git
- node_modules
- tests
- documentation
- local environment files

These files increase build time even if they are never copied into the image.

---

# Professional .dockerignore

```dockerignore
# Git
.git
.gitignore

# GitHub
.github

# Local dependencies
node_modules

# Logs
*.log

# Documentation
README.md
docs/

# Tests
tests/

# Environment Files
.env
.env.*

# IDE
.vscode
.idea

# Temporary
tmp/
temp/

# Coverage Reports
coverage/

# Docker Compose
docker-compose.yml
```

---

# Why Ignore node_modules?

Local `node_modules` may have been built for:

- Windows
- macOS

Docker builds typically use Linux.

Copying local dependencies can create compatibility issues.

Instead, dependencies should always be installed inside Docker.

```dockerfile
RUN npm ci
```

This guarantees platform-compatible packages.

---

# Build Context

Without `.dockerignore`

```
Laptop

↓

Everything

↓

Docker Daemon
```

With `.dockerignore`

```
Laptop

↓

Only Required Files

↓

Docker Daemon
```

This results in:

- Faster builds
- Smaller build context
- Less network transfer
- Better security

---

# Final Runtime Image

The final production image should contain:

```
/app

├── server.js
├── app.js
├── package.json
├── package-lock.json
├── node_modules (Production Only)
├── routes/
├── controllers/
├── middleware/
├── models/
├── config/
└── utils/
```

The final image should NOT contain:

```
✗ tests/
✗ docs/
✗ .git/
✗ .github/
✗ README.md
✗ .env
✗ Local node_modules
✗ Jest
✗ ESLint
✗ Nodemon
✗ Prettier
```

---

# Best Practices

- Use Multi-stage Builds for production images.
- Name build stages using `AS`.
- Prefer `COPY --from=<stage-name>` over stage numbers.
- Install development dependencies only in the Builder stage.
- Install production dependencies in the Runtime stage using:

```bash
npm ci --omit=dev
```

- Use `.dockerignore` to reduce build context.
- Never copy local `node_modules` into Docker.
- Keep production images as small as possible.
- Reduce the attack surface by removing unnecessary software.

---

# Interview Questions

## Why use Multi-stage Builds?

To separate the build environment from the runtime environment, reducing image size and improving security.

---

## Does the second FROM inherit the first stage?

No.

Every `FROM` starts a completely new build stage.

Files must be copied explicitly using:

```dockerfile
COPY --from=<stage>
```

---

## Where does COPY --from copy files from?

It copies files from:

- Another build stage, or
- An external Docker image.

It does NOT copy files from the local machine.

---

## Why run npm ci twice?

The first installation provides all dependencies needed for building and testing.

The second installs only production dependencies for the runtime image.

---

## Why ignore node_modules?

Local node_modules may contain platform-specific binaries.

Installing dependencies inside Docker ensures compatibility with the container's operating system.

---

# Key Learnings

- Multi-stage Builds separate building from running.
- Every `FROM` creates a new independent filesystem.
- `COPY --from` copies files from another stage or image.
- Production images should contain only runtime dependencies.
- `.dockerignore` reduces the build context before Docker starts building.
- Smaller images improve deployment speed, security, and maintainability.
- Never copy local `node_modules` into a Docker image.