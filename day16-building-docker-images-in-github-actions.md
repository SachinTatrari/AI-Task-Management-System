# Day 16 - Building Docker Images in GitHub Actions

## Objective

Understand why CI pipelines build Docker images, why runtime versions should be pinned, and how GitHub Actions and Docker interact.

---

# Pipeline Before Today

Our CI pipeline looked like this:

```
Push
│
▼
Checkout Code
│
▼
Setup Node
│
▼
npm install
│
▼
npm test
│
▼
Pipeline Ends
```

This validated the application but did not produce a deployable artifact.

---

# Why Build Docker Images?

Running tests only answers one question:

> Does the application work?

It does **not** answer:

> Can this application actually be packaged for deployment?

To answer that, we add:

```yaml
- name: Build Docker Image
  run: docker build -t ai-task-management-system .
```

Now the pipeline verifies that the Docker image can also be created successfully.

---

# Updated Pipeline

```
Push
│
▼
Checkout Code
│
▼
Setup Node
│
▼
npm install
│
▼
npm test
│
▼
docker build
│
▼
Pipeline Success
```

---

# Validation vs Packaging

These are different phases.

## Validation

Checks whether the application is correct.

Examples:

- npm install
- npm test

Purpose:

"Does the application work?"

---

## Packaging

Creates something deployable.

Example:

```
docker build
```

Purpose:

"Can this application be packaged into a deployable Docker image?"

---

# What Happens During docker build?

GitHub Runner executes exactly the same command that we execute locally.

```
docker build -t ai-task-management-system .
```

Docker performs:

1. Reads Dockerfile
2. Downloads base image (if needed)
3. Executes Dockerfile instructions
4. Creates Docker image
5. Stores image in the runner's Docker daemon

---

# Does the Docker Image Really Exist?

Yes.

The logs confirmed:

```
writing image sha256:...
naming to docker.io/library/ai-task-management-system
```

This proves the image was successfully created.

---

# Then Where Does the Image Go?

Remember:

GitHub runners are temporary.

```
Runner Created
        │
Build Image
        │
Runner Destroyed
        │
Docker Daemon Destroyed
        │
Image Lost
```

The image exists only during that workflow.

Later we will push images to Docker Hub (or another container registry) so they survive after the runner is destroyed.

---

# Important Observation From the Logs

The build logs showed:

```
npm WARN EBADENGINE

required:
Node >=20.19.0

current:
Node 18
```

Packages producing warnings included:

- mongoose
- mongodb
- bson
- mquery

The build succeeded because these are warnings, not errors.

However, this indicates that our runtime version is older than recommended.

---

# Runtime Version Consistency

Initially our workflow looked like:

```yaml
- uses: actions/setup-node@v4
```

without specifying a version.

GitHub therefore used the default Node version available on the hosted runner.

To make builds reproducible, we updated it to:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
```

We also updated our Dockerfile:

```dockerfile
FROM node:20
```

Now both environments use the same Node version.

---

# Are GitHub Actions and Docker Connected?

No.

They are two completely independent environments.

```
GitHub Runner
│
├── actions/setup-node
│       │
│       └── Node used for:
│             npm install
│             npm test
│
└── Docker Engine
        │
        └── Dockerfile
                │
                └── FROM node:20
                        │
                        └── RUN npm install
```

The Node installed by `actions/setup-node` is **not** the Node inside the Docker image.

Docker uses whatever version is specified in the Dockerfile.

---

# Why Keep Both Versions the Same?

Imagine:

Runner:

```
Node 22
```

Docker Image:

```
Node 18
```

CI tests may pass using Node 22.

Production may fail because the container runs Node 18.

Using the same version everywhere reduces environment-specific bugs.

---

# Why Not Use "latest"?

It might seem tempting to write:

Dockerfile

```dockerfile
FROM node:latest
```

Workflow

```yaml
node-version: latest
```

This is discouraged.

Reason:

The meaning of "latest" changes over time.

One day Node 24 might be latest.

A few months later Node 25 becomes latest.

Your pipeline could suddenly fail without any changes to your code.

Professional teams prefer stable, predictable builds.

---

# Best Practice

Pin the runtime version.

Example:

Dockerfile

```dockerfile
FROM node:20
```

Workflow

```yaml
with:
  node-version: 20
```

Upgrade intentionally after testing rather than automatically following every new release.

---

# Key Learnings

- CI validates the application.
- Docker build validates packaging.
- GitHub runners are temporary.
- Docker images created during CI disappear with the runner unless pushed to a registry.
- `actions/setup-node` and `FROM node:20` configure two independent environments.
- Keeping both versions aligned reduces deployment surprises.
- Avoid `latest` for production pipelines.
- Pin runtime versions for reproducible builds.

---

# Biggest Takeaway

A professional CI pipeline should not only prove that the application works.

It should also prove that the exact runtime used in production can successfully build a deployable artifact in a clean, reproducible environment.