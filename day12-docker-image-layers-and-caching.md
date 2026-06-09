# Day 12 - Docker Image Layers and Caching

## Objective

Understand:

- Docker image layers
- Layer hierarchy
- Image inheritance
- Docker build cache
- Cache invalidation
- Dockerfile optimization
- BuildKit
- Image naming
- Compose image creation
- Build vs Pull
- Layer sharing

This day focused on understanding what actually happens during image creation and why Docker builds are efficient.

---

# Important Realization

Docker images are NOT one giant file.

Instead, images consist of multiple layers stacked together.

Example:

CMD
↑
COPY source code
↑
RUN npm install
↑
COPY package.json
↑
WORKDIR
↑
Base Image

Every instruction creates a layer.

---

# Dockerfile

Current Dockerfile:

```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm","run","dev"]
```

---

# Layer Breakdown

## Layer 1

```dockerfile
FROM node:18
```

Base image layer.

---

## Layer 2

```dockerfile
WORKDIR /app
```

Metadata layer.

---

## Layer 3

```dockerfile
COPY package*.json ./
```

Copies dependency definitions.

---

## Layer 4

```dockerfile
RUN npm install
```

Installs dependencies.

One of the heaviest layers.

---

## Layer 5

```dockerfile
COPY . .
```

Copies source code.

---

## Layer 6

```dockerfile
CMD ["npm","run","dev"]
```

Container startup instruction.

---

# Docker History

Command:

```bash
docker history ai-task-management-system-app
```

reveals layer history.

---

# Important Realization

Docker history does NOT show:

"What happened recently?"

It shows:

"How this image came into existence."

Including:

- Debian
- Node.js
- Application layers

---

# Image Inheritance

Current hierarchy:

Application Image
↑
Node 18 Image
↑
Debian Linux

---

# Why Layers From 2 And 3 Years Ago Appeared

Observation:

History showed layers created:

- 14 months ago
- 2 years ago
- 3 years ago

Initial confusion:

Application itself was created recently.

---

# Explanation

Parent images have their own history.

Example:

Debian Bookworm
↑
Node 18
↑
Application

Docker history displays the entire ancestry.

---

# Understanding <missing>

History showed:

```plaintext
<missing>
```

for many layers.

---

# Important Understanding

This does NOT mean:

- missing files
- corruption
- errors

These are intermediate layers.

Modern BuildKit optimizes and merges layers.

Layers still exist logically but are no longer tagged images.

---

# Build Cache

Docker reuses previously built layers.

Example:

```plaintext
Layer 1
Layer 2
Layer 3
Layer 4
Layer 5
```

If Layer 3 remains unchanged:

Layer 4 and Layer 5 may also be reused.

---

# Cache Optimization

Current Dockerfile:

```dockerfile
COPY package*.json ./

RUN npm install

COPY . .
```

This order is intentional.

---

# Why?

Changing:

```plaintext
taskController.js
```

does not affect:

```plaintext
package.json
```

Therefore:

```dockerfile
RUN npm install
```

remains cached.

Only:

```dockerfile
COPY . .
```

is rebuilt.

---

# Bad Dockerfile Example

```dockerfile
COPY . .

RUN npm install
```

Problem:

Any source code change invalidates:

COPY . .

which forces:

RUN npm install

to execute again.

Builds become slow.

---

# Cache Invalidation

Suppose package.json changes.

Example:

Adding:

```json
cors
```

Changes:

```dockerfile
COPY package*.json ./
```

Therefore:

```dockerfile
RUN npm install
```

must run again.

All upper layers are rebuilt.

---

# Layer Dependency Principle

If Layer 3 changes:

Layer 4 rebuilds.

Layer 5 rebuilds.

Layers above depend on layers below.

---

# Debugging Session - Wrong History Output

Initial observation:

```bash
docker history ai-task-management-system
```

showed:

```plaintext
CMD ["npm","start"]
```

instead of:

```plaintext
CMD ["npm","run","dev"]
```

Even though container was running nodemon.

---

# Investigation

Container logs confirmed:

```plaintext
nodemon src/server.js
```

Therefore image behavior and history seemed inconsistent.

---

# Root Cause

Multiple images existed.

```plaintext
ai-task-management-system
```

and

```plaintext
ai-task-management-system-app
```

---

# Why?

Earlier:

Manual build created:

```bash
docker build -t ai-task-management-system .
```

Later:

Docker Compose created:

```plaintext
ai-task-management-system-app
```

for service:

```yaml
app:
```

---

# Important Realization

Container was using:

```plaintext
ai-task-management-system-app
```

but history command inspected:

```plaintext
ai-task-management-system
```

Different images.

---

# Compose Image Naming

Compose automatically creates:

```plaintext
project-name + service-name
```

Example:

Project:

```plaintext
ai-task-management-system
```

Service:

```plaintext
app
```

Generated image:

```plaintext
ai-task-management-system-app
```

---

# Why This Is Useful

Suppose services are:

- app
- nginx
- redis
- worker

Compose creates:

- project-app
- project-nginx
- project-redis
- project-worker

which keeps everything organized.

---

# Build vs Pull

Compose supports two approaches.

---

## Build

```yaml
app:
  build: .
```

Meaning:

Source Code
+
Dockerfile
↓
Build image

---

## Use Existing Image

```yaml
mongo:
  image: mongo:7
```

Meaning:

Pull image from Docker Hub.

No build required.

---

# Why Mongo Image Was Not Created

MongoDB already provides:

```plaintext
mongo:7
```

official image.

Compose simply pulls and uses it.

---

# Infrastructure Principle

Build what is unique.

Reuse what already exists.

---

# Typical Real Systems

Build:

- backend
- frontend
- internal services

Reuse:

- MongoDB
- Redis
- PostgreSQL
- Nginx
- Prometheus
- Grafana

---

# Layer Sharing

Observation:

Images:

```plaintext
ai-task-management-system-app
1.62 GB

ai-task-management-system
1.59 GB
```

might appear to consume:

3.21 GB.

---

# Important Realization

Docker shares common layers.

Storage used is:

Shared Layers
+
Differences

NOT:

Image1 + Image2

---

# BuildKit

Modern Docker uses BuildKit.

Benefits:

- caching
- optimization
- layer reuse
- parallelism

---

# Key Learnings

- Images consist of layers.
- Parent image history is inherited.
- Build cache improves performance.
- Dockerfile order matters.
- Package dependencies should be copied separately.
- BuildKit optimizes layer storage.
- Compose generates image names automatically.
- Build and pull are different concepts.
- Official images are reused instead of rebuilt.
- Docker shares common layers.

---

# Key Takeaway

Infrastructure engineering is about avoiding unnecessary work.

Docker caching is one example of this principle.

The same idea appears later in:

- CI/CD
- Kubernetes
- Terraform
- CDN caching
- Database indexing
- Distributed systems

Efficient systems are built by reusing expensive work instead of repeating it.