# Day 10 - Bind Mounts, Live Reload and Development Workflows

## Objective

Understand:

- bind mounts
- live file synchronization
- nodemon
- automatic application restart
- development containers
- production containers
- container filesystem behavior
- debugging file watching issues

This was the first day focused on improving developer workflow inside containers.

---

# The Problem We Had

Current workflow:

Change code
↓
Rebuild image
↓
Restart container

Example:

```bash
docker compose up --build
```

This works but becomes slow during active development.

Every code change forces image rebuild.

---

# Why Rebuilds Were Required Earlier

Dockerfile contains:

```dockerfile
COPY . .
```

During image build:

Source Code
↓
Copied into image
↓
Image Snapshot Created

After image creation:

- image contains fixed snapshot
- local file changes do not affect image

Therefore rebuild was required.

---

# Introduction to Bind Mounts

Bind mount directly connects:

Host Machine Folder
↓
Container Folder

instead of copying files.

---

# Bind Mount Configuration

Inside docker-compose.yml:

```yaml
app:
  volumes:
    - .:/app
```

---

# Understanding The Syntax

## Left Side

```plaintext
.
```

Current project folder on host machine.

---

## Right Side

```plaintext
/app
```

Directory inside container.

---

# What This Means

Host Project Files
↕
Container Files

Changes become visible immediately.

No image rebuild required.

---

# Before Bind Mount

Host Files
↓
Copied into Image
↓
Container

Changes required rebuild.

---

# After Bind Mount

Host Files
↕
Container Filesystem

Changes become available instantly.

---

# Bind Mount vs Named Volume

One of the most important distinctions learned.

---

# Bind Mount

Example:

```yaml
- .:/app
```

Purpose:

- development workflow
- live code syncing
- file sharing

Source:
Host machine filesystem.

---

# Named Volume

Example:

```yaml
- mongo-data:/data/db
```

Purpose:

- persistent storage
- database durability

Source:
Docker-managed storage.

---

# Key Difference

Bind Mount:
Host controls files.

Named Volume:
Docker controls files.

---

# Nodemon

Problem:

Even if files update inside container,
Node.js process does not automatically restart.

---

# Solution

Install:

```bash
npm install --save-dev nodemon
```

---

# package.json

Added:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js"
}
```

---

# Dockerfile Change

Previous:

```dockerfile
CMD ["npm", "start"]
```

New:

```dockerfile
CMD ["npm", "run", "dev"]
```

---

# What Nodemon Does

Watches files.

When file changes:

File Changed
↓
Nodemon Detects Change
↓
Node Process Restarted
↓
Updated Code Runs

---

# Development Container vs Production Container

Very important infrastructure concept.

---

# Development Container

Goals:

- fast feedback
- debugging
- hot reload
- rapid development

Usually contains:

- nodemon
- bind mounts
- developer tooling

---

# Production Container

Goals:

- stability
- security
- performance
- predictability

Usually contains:

- minimal dependencies
- no nodemon
- no bind mounts

---

# Important Realization

Production and development environments have different requirements.

Professional systems often maintain:

```plaintext
Dockerfile.dev
Dockerfile.prod
```

or separate compose files.

---

# Debugging Session - Nodemon Not Restarting

One of the most important debugging exercises so far.

---

# Problem

Code changes were not reflected.

Example:

Changed API response:

```plaintext
Bucket is Empty
```

to:

```plaintext
Bucket is Void
```

but API response remained unchanged.

---

# Initial Assumption

Possibilities:

- Docker image issue
- Bind mount issue
- Nodemon issue
- Application logic issue

---

# Debugging Approach

Instead of randomly changing things,
the system was broken into layers.

---

# Layer 1

Verify container starts with nodemon.

Observed logs:

```plaintext
nodemon src/server.js
```

Conclusion:

Nodemon was running.

Dockerfile was correct.

---

# Layer 2

Verify bind mount.

Entered container:

```bash
docker compose exec app sh
```

Checked file:

```bash
cat src/server.js
```

Observed latest code changes inside container.

Conclusion:

Bind mount working correctly.

---

# Layer 3

Check if nodemon detects file changes.

Added:

```js
console.log("FILE CHANGED");
```

Saved file.

Observed:

No restart logs.

No new output.

Conclusion:

Nodemon was not detecting file changes.

---

# Root Cause

Running on:

Windows
↓
Docker Desktop
↓
Linux Container

Filesystem change events were not reaching nodemon properly.

This is a common issue on Windows.

---

# Solution

Changed script:

```json
"dev": "nodemon --legacy-watch src/server.js"
```

or:

```json
"dev": "nodemon -L src/server.js"
```

---

# What Legacy Watch Does

Normal nodemon:

Waits for filesystem events.

Example:

- file modified
- file renamed
- file saved

---

# Problem

Windows → Docker → Linux sometimes fails to forward those events.

---

# Legacy Watch

Uses polling.

Meaning:

Repeatedly checks files for changes.

Instead of waiting for filesystem events.

Less efficient but much more reliable.

---

# Result

After enabling legacy watch:

File Changed
↓
Nodemon Detected Change
↓
Automatic Restart
↓
Updated API Response Visible

Live reload started working correctly.

---

# Important Infrastructure Lesson

A problem should be debugged layer by layer.

Workflow used:

Host File
↓
Bind Mount
↓
Container Filesystem
↓
File Watcher
↓
Node Restart
↓
Application Response

Each layer was verified independently.

---

# Key Learnings

- Bind mounts synchronize host files with containers.
- Named volumes are used for persistent storage.
- Nodemon provides automatic restart during development.
- Development and production containers serve different purposes.
- Docker images contain snapshots.
- Bind mounts provide live file access.
- Windows Docker environments may require legacy file watching.
- Systematic debugging is more effective than guessing.

---

# Key Takeaway

Containerized development is not just about running applications.

It is about creating fast feedback loops:

Code Change
↓
Automatic Detection
↓
Application Restart
↓
Immediate Validation

This is the foundation of an efficient developer workflow.