# Day 6 - Docker Fundamentals

## Objective

Learn the basics of containerization and run the Node.js application inside a Docker container.

---

# Important Concepts Learned

## Why Docker Exists

Docker solves:
"It works on my machine" problem.

Without Docker:
applications depend on:
- local machine setup
- local Node.js installation
- local environment configuration

Docker packages:
- application
- dependencies
- runtime
- environment

into a consistent deployable unit.

---

# Image vs Container

## Docker Image

Image is:
- blueprint/template
- packaged application definition

Contains:
- application code
- dependencies
- runtime environment

Image itself is not running.

---

## Docker Container

Container is:
- running instance of image

Container executes the application.

Relationship:

Dockerfile
↓
Docker Image
↓
Docker Container

---

# Dockerfile

Created Dockerfile in project root.

Purpose:
Define how Docker should build application image.

Current Dockerfile:

```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

Detailed breakdown will be studied later.

---

# Docker Build Process

Built Docker image using:

```bash
docker build -t ai-task-management-system .
```

Learned:
- `docker build` creates image
- `-t` assigns image tag/name
- `.` means current directory contains Dockerfile

---

# Running Container

Command used:

```bash
docker run -p 3007:3000 ai-task-management-system
```

---

# Port Mapping Understanding

Format:

```plaintext
HOST_PORT : CONTAINER_PORT
```

Example:

```plaintext
3007:3000
```

Meaning:
- host machine uses port 3007
- traffic forwarded to container port 3000

---

# Important Networking Understanding

Container has isolated environment and separate internal networking.

Container port and host port are different concepts.

Flow:

Laptop Host
↓
Host Port 3007
↓
Docker Port Mapping
↓
Container Port 3000
↓
Node.js Application

---

# Debugging Session

## Problem Faced

Error:

```plaintext
Ports are not available...
bind: Only one usage of each socket address...
```

---

## Root Cause

Host machine port 3000 was already occupied.

Most likely by:
- local Node.js app
OR
- another container

---

## Important Realization

Issue was:
- host-side port conflict
- NOT container issue

Changing:

```dockerfile
EXPOSE 3000
```

would NOT solve the problem.

---

## Fix

Used different host port:

```bash
docker run -p 3007:3000 ai-task-management-system
```

Application became accessible at:

```plaintext
http://localhost:3007
```

---

# Key Infrastructure Learnings

- Containers run in isolated environments.
- Host ports and container ports are separate.
- Docker packages runtime dependencies.
- Port mapping connects host machine to containers.
- Docker improves environment consistency.

---

# Key Takeaway

Containerization is not just running applications.

It is about:
- reproducibility
- environment consistency
- deployment portability
- infrastructure standardization