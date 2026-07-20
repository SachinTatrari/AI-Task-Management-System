# Day 17 – Container Registries & Docker Hub

## Objective

Today I learned how Docker images move from my local machine (or GitHub Actions runner) to a container registry.

Until yesterday, my CI pipeline could automatically build Docker images.

Today I extended it so that every successful build is automatically published to Docker Hub.

This completes my first end-to-end CI pipeline.

---

# Previous Pipeline

```
Git Push
    │
    ▼
Checkout
    │
    ▼
Install Dependencies
    │
    ▼
Run Tests
    │
    ▼
Build Docker Image
```

The image existed only inside the GitHub Actions runner.

After the workflow completed, the runner was destroyed and the image disappeared.

---

# New Pipeline

```
Git Push
    │
    ▼
Checkout
    │
    ▼
Install Dependencies
    │
    ▼
Run Tests
    │
    ▼
Login to Docker Hub
    │
    ▼
Build Docker Image
    │
    ▼
Tag Image
    │
    ▼
Push Image
    │
    ▼
Docker Hub
```

Now every successful build produces a Docker image that is permanently stored in Docker Hub.

---

# Why Do We Need Container Registries?

A Docker image built on my laptop exists only on my laptop.

Similarly, an image built inside GitHub Actions exists only on the temporary GitHub runner.

```
GitHub Runner

↓

Docker Image

↓

Runner Destroyed

↓

Image Lost
```

To keep images permanently and share them across machines, they must be uploaded to a container registry.

Examples include:

- Docker Hub
- GitHub Container Registry (GHCR)
- Amazon Elastic Container Registry (ECR)
- Google Artifact Registry
- Azure Container Registry (ACR)

A container registry is similar to GitHub, but instead of storing source code, it stores Docker images.

---

# Docker Hub

Docker Hub is Docker's public image registry.

Official images such as:

- node
- nginx
- ubuntu
- mysql
- redis

are all hosted there.

My own Docker repository:

```
sachin3586/ai-task-management-system-image
```

stores images built from my application.

---

# Docker Repository Naming

Image names follow this pattern:

```
username/repository:tag
```

Example:

```
sachin3586/ai-task-management-system-image:latest
```

Breaking it down:

```
Username
↓

sachin3586

Repository
↓

ai-task-management-system-image

Tag
↓

latest
```

---

# Authentication

Before pushing images, Docker must authenticate.

GitHub Actions cannot use my Docker Hub password directly.

Instead, I generated a Docker Hub Access Token.

GitHub Repository Secrets:

```
DOCKER_USERNAME

DOCKER_TOKEN
```

Workflow:

```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKER_USERNAME }}
    password: ${{ secrets.DOCKER_TOKEN }}
```

The login action authenticates once, after which subsequent Docker commands can push images.

---

# Why GitHub Secrets?

Sensitive values should never be committed to Git.

Instead:

```
GitHub Repository

↓

Secrets

↓

Encrypted Storage

↓

Workflow Reads Secret

↓

Secret Never Appears In Repository
```

This keeps credentials secure.

---

# Docker Build & Push Action

Instead of manually writing:

```bash
docker build
docker push
```

I used Docker's official GitHub Action.

```yaml
- name: Build and Push Docker Image
  uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: sachin3586/ai-task-management-system-image:latest
```

Advantages:

- Cleaner workflow
- Uses BuildKit
- Better caching support
- Easier multi-platform builds
- Industry standard

---

# Understanding Each Parameter

## context

```
context: .
```

This tells Docker to use the current project directory as the build context.

Equivalent to:

```
docker build .
```

---

## push

```
push: true
```

Without this:

```
Build

↓

Stop
```

With this:

```
Build

↓

Push to Docker Hub
```

---

## tags

```
tags:
sachin3586/ai-task-management-system-image:latest
```

This specifies the image name that Docker Hub should store.

---

# Build Logs Explained

## Step 1

Docker Action started.

```
docker/build-push-action
```

---

## Step 2

Docker inspected the environment.

Collected:

- Docker Engine version
- Buildx version
- Compose version
- CPU
- Memory
- Kernel
- Operating System

---

## Step 3

Docker converted the workflow into:

```
docker buildx build ... --push
```

The GitHub Action is simply a wrapper around Docker CLI.

---

## Step 4

Docker loaded the Dockerfile.

```
load build definition from Dockerfile
```

---

## Step 5

Docker downloaded the base image.

```
FROM node:20
```

Docker requested the official Node image from Docker Hub.

---

## Step 6

Docker transferred the build context.

```
Project Folder

↓

Build Context

↓

Docker Engine
```

Everything inside the build context becomes available during the build.

---

## Step 7

Docker executed the Dockerfile.

```
FROM

↓

WORKDIR

↓

COPY package.json

↓

RUN npm install

↓

COPY .

↓

CMD
```

Instructions execute from top to bottom.

---

## Step 8

npm installed dependencies.

```
added 110 packages
```

Warnings:

- 1 moderate vulnerability
- New npm version available

Neither prevented the image from building.

---

## Step 9

Docker exported the image.

```
writing image sha256:...
```

At this moment the Docker image officially existed.

---

## Step 10

Docker tagged the image.

```
docker.io/sachin3586/ai-task-management-system-image:latest
```

The tag provides a human-readable name.

---

## Step 11

Docker pushed layers.

Instead of uploading one huge file:

```
Image

↓

Layer A

↓

Layer B

↓

Layer C
```

Each layer is uploaded separately.

This makes future pushes much faster because unchanged layers are reused.

---

# Understanding Tags

Initially I used:

```
latest
```

Example:

```
latest

↓

Image A
```

After another build:

```
latest

↓

Image B
```

The latest tag simply moves to the newest image.

Older images are no longer referenced by that tag.

---

# Better Tagging Strategy

A production-friendly approach is:

```yaml
tags: |
  sachin3586/ai-task-management-system-image:latest
  sachin3586/ai-task-management-system-image:${{ github.sha }}
```

This creates:

```
latest

↓

Newest Image

Commit SHA

↓

Exact Build
```

Benefits:

- Easy rollback
- Complete traceability
- Every build uniquely identified

---

# Difference Between Tags And Digests

Tag:

```
latest
```

can change.

Digest:

```
sha256:xxxxxxxx...
```

never changes.

Production deployments often use image digests because they always reference exactly one immutable image.

---

# Key Learnings

- Docker images built inside GitHub Actions disappear after the runner is destroyed.
- Container registries permanently store Docker images.
- Docker Hub is the most widely used public container registry.
- Authentication is handled securely using GitHub Secrets and Docker Hub Access Tokens.
- The docker/build-push-action wraps Docker CLI commands.
- Docker executes Dockerfiles from top to bottom.
- Images are uploaded layer by layer.
- Tags are movable labels.
- Digests uniquely identify immutable images.
- Using both latest and commit SHA tags is considered a best practice.

---

# Biggest Takeaway

Today my CI pipeline evolved from simply validating code to automatically producing and publishing a deployable artifact.

For the first time, every successful push to GitHub automatically creates a Docker image that can be pulled and deployed from anywhere.