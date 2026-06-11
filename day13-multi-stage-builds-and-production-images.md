# Day 13 - Multi-Stage Builds and Production Images

## Objective

Understand:

- Development images vs production images
- Why large images are undesirable
- Multi-stage builds
- Multiple FROM instructions
- Builder stage vs runtime stage
- Separation of build environment and runtime environment
- Image optimization principles

This day focused on understanding how professional systems separate the process of creating an application from running the application.

---

# Initial Question

Why do development and production need different images?

Current image size:

```plaintext
1.62 GB
```

contains:

- source code
- npm
- node runtime
- nodemon
- development dependencies
- caches
- temporary files

Suitable for development but not ideal for production.

---

# Development Container

Purpose:

Fast development.

Contains:

- nodemon
- debugging tools
- development dependencies
- bind mounts

Goal:

Rapid iteration.

---

# Production Container

Purpose:

Stable runtime.

Contains only:

- application
- required dependencies
- runtime

Goal:

- smaller size
- lower attack surface
- faster deployment
- predictability

---

# Multi-Stage Builds

Docker supports multiple stages.

Example:

```dockerfile
FROM node:18 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# --------------------

FROM node:18-slim

WORKDIR /app

COPY --from=builder /app .

CMD ["node","src/server.js"]
```

---

# Important Observation

Dockerfile contains:

```dockerfile
FROM

...

FROM
```

Multiple FROM instructions are allowed.

Every FROM starts a new stage.

---

# Builder Stage

First stage:

```dockerfile
FROM node:18 AS builder
```

Purpose:

Construct the application.

Contains:

- npm
- node
- dependencies
- source code
- caches
- temporary artifacts

Analogy:

Construction site.

---

# Runtime Stage

Second stage:

```dockerfile
FROM node:18-slim
```

Purpose:

Run the application.

Contains only what is needed.

Analogy:

Finished house.

---

# Initial Confusion

Question:

If npm install already happened in builder stage, why create another image?

---

# Important Realization

We are interested in:

THE RESULT

not

THE WORKSHOP.

---

# House Construction Analogy

During construction:

- workers
- ladders
- cranes
- scaffolding

are required.

After completion:

House remains.

Construction equipment is removed.

---

# Builder Stage Philosophy

Builder environment contains tools required to create the product.

Runtime environment contains only the finished product.

---

# COPY --from

Instruction:

```dockerfile
COPY --from=builder /app .
```

means:

Copy files from builder stage into current stage.

Builder image itself is not used as runtime image.

Only its output is used.

---

# Separation Principle

Build Environment
↓
Creates Product
↓
Runtime Environment Executes Product

This is one of the most important software engineering principles.

---

# Real World Example - Java

Builder:

Contains:

- Maven
- JDK
- source code

Produces:

```plaintext
app.jar
```

Runtime:

Contains:

- JRE
- app.jar

No Maven required.

---

# Real World Example - React

Builder:

```plaintext
npm
source code
```

Runs:

```bash
npm run build
```

Produces:

```plaintext
dist/
```

Runtime:

Nginx image

Contains:

- html
- css
- js

No npm or source code.

---

# Observation About Current Example

Current example:

```dockerfile
COPY --from=builder /app .
```

copies almost everything.

Therefore optimization is limited.

---

# Better Production Version

Builder:

```dockerfile
FROM node:18 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .
```

Runtime:

```dockerfile
FROM node:18-slim

WORKDIR /app

COPY --from=builder /app .

CMD ["node","src/server.js"]
```

This excludes:

- nodemon
- development dependencies

leading to smaller production images.

---

# Builder Stage Disappears

Only final stage becomes the image.

Builder stage exists only during image creation.

---

# Why Smaller Images Matter

Benefits:

- faster pull
- faster deployment
- lower storage
- better security
- reduced attack surface

---

# Professional Practice

Separate Dockerfiles often exist:

Development:

```plaintext
Dockerfile.dev
```

Production:

```plaintext
Dockerfile.prod
```

Different environments have different requirements.

---

# Important Engineering Principle

A system should contain only what it needs to perform its job.

This principle appears in:

- Docker
- Kubernetes
- Linux
- Cloud Architecture
- Security
- CI/CD

---

# Biggest Lesson

We preserve:

THE PRODUCT

not

THE WORKSHOP.

Builder stages are temporary.

Runtime stages are permanent.

---

# Key Learnings

- Multiple FROM instructions create multiple stages.
- Builder and runtime environments are different.
- COPY --from copies artifacts from another stage.
- Production images should contain only what is necessary.
- Smaller images improve performance and security.
- Multi-stage builds separate construction from execution.
- Development and production have different requirements.

---

# Key Takeaway

Professional systems separate:

Creation

from

Execution.

The build environment creates the application.

The runtime environment executes the application.

Understanding this separation is one of the foundational ideas behind modern containerized systems.