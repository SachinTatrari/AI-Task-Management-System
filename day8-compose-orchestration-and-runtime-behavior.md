# Day 8 - Docker Compose, Orchestration and Runtime Behavior

## Objective

Learn:
- multi-container application architecture
- Docker Compose basics
- service orchestration
- container communication
- image rebuild behavior
- async startup behavior
- runtime lifecycle understanding

This was the first real distributed application setup.

---

# Multi-Container Architecture

System now consists of:

Node.js Application Container
↓
MongoDB Container

Both services run independently but communicate through Docker networking.

---

# Important Architecture Understanding

Containers should ideally perform:
ONE RESPONSIBILITY.

Example:

### App Container
Responsible for:
- backend APIs
- request handling
- business logic

---

### MongoDB Container
Responsible for:
- database storage
- database queries

This separation improves:
- scalability
- maintainability
- deployment flexibility

---

# Docker Compose Introduction

Docker Compose helps orchestrate multiple related containers together.

Command used:

```bash
docker compose up
```

Compose automatically:
- creates network
- starts containers
- manages service communication
- manages logs
- manages orchestration lifecycle

---

# Internal Service Communication

Compose file used:

```yaml
environment:
  - MONGO_URI=mongodb://mongo:27017/taskdb
```

---

# Important Understanding

`mongo` works because:
Docker Compose automatically creates:
- internal network
- DNS-based service discovery

Service names become hostnames inside Docker network.

Meaning:
Node.js container can reach MongoDB container using:

```plaintext
mongo
```

instead of:
- localhost
- IP addresses

---

# Big Infrastructure Understanding

Docker Compose introduces:
SERVICE ORCHESTRATION.

This is foundational knowledge for:
- Kubernetes
- distributed systems
- cloud-native architecture

---

# Deep Understanding of Container Communication

One of the most important learnings was understanding how containers communicate with each other.

---

# Initial Confusion

Normally in local development:
database connection strings often look like:

```plaintext
mongodb://localhost:27017/taskdb
```

But inside Docker Compose:

```plaintext
mongodb://mongo:27017/taskdb
```

was used instead.

---

# Why localhost Does NOT Work Here

Inside containers:
`localhost` means:
THE CONTAINER ITSELF

NOT the host machine.

---

# Example

Inside app container:

```plaintext
localhost
```

refers to:
- app container itself
- NOT Mongo container

So if app container tries:

```plaintext
mongodb://localhost:27017
```

it searches for MongoDB inside app container itself.

MongoDB does not exist there.

Connection fails.

---

# Docker Compose Networking

Docker Compose automatically creates:
- isolated internal network
- DNS resolution between services

Each service gets:
- hostname
- internal IP address

---

# Important Realization

Service names become DNS hostnames automatically.

Example:

```yaml
services:

  app:

  mongo:
```

Now:
```plaintext
mongo
```

becomes valid hostname inside compose network.

---

# Actual Communication Flow

Node.js Container
↓
Requests hostname "mongo"
↓
Docker internal DNS resolves hostname
↓
Mongo container IP returned
↓
TCP connection established on port 27017

---

# Important Infrastructure Understanding

Containers communicate through:
INTERNAL VIRTUAL NETWORKS.

Docker automatically handles:
- networking
- DNS resolution
- service discovery

---

# Host Machine Is NOT Involved

Communication between containers happens internally inside Docker network.

Traffic does not go:
through browser or host networking first.

---

# Important Mental Model

Docker Compose creates something similar to:

Private Virtual Data Center

where services can discover each other using service names.

---

# Why This Is Important

This becomes foundational later for:
- Kubernetes services
- microservices
- distributed systems
- cloud-native networking
- service discovery

---

# Key Takeaway

Container communication is NOT based on localhost.

Containers communicate through:
- Docker-created internal networks
- service discovery
- DNS-based hostname resolution

# Debugging Session 1 - Image Rebuild Issue

## Problem Faced

Syntax error:

```plaintext
connectDB has already been declared
```

Root cause:
Duplicate declaration accidentally added in `server.js`.

---

# Fix Attempt

Duplicate line removed locally.

Then executed:

```bash
docker compose up
```

But same error still appeared.

---

# Important Discovery

Docker Compose reused existing cached image.

Container was still running old filesystem snapshot.

---

# Key Understanding

Containers run:
IMAGE SNAPSHOTS

NOT automatically updated live source code.

---

# Correct Fix

Used:

```bash
docker compose up --build
```

This forced image rebuild.

---

# Important Infrastructure Learning

Docker images are:
IMMUTABLE SNAPSHOTS.

If source code changes:
image usually needs rebuild.

---

# Image Lifecycle Understanding

Source Code
↓
docker build
↓
Image Snapshot Created
↓
Container Runs Image Snapshot

Changing local files does not automatically modify already-built image.

---

# Debugging Session 2 - Why Ctrl+C Stopped Containers

Observation:
Pressing Ctrl+C stopped:
- app container
- mongo container

even though app container had already crashed.

---

# Important Understanding

Docker Compose manages:
ENTIRE APPLICATION STACK.

When running:

```bash
docker compose up
```

Compose orchestrates all services together.

Ctrl+C means:
"Stop compose orchestration session."

Compose then gracefully stops managed containers.

---

# Important Realization

Even though Node.js container crashed:
MongoDB container was still healthy and running.

Verified using:

```bash
docker ps
```

Only MongoDB container appeared.

---

# Why Node.js Container Disappeared

Containers fundamentally exist around:
MAIN PROCESS.

Node container lifecycle:

Container Starts
↓
node server.js executes
↓
Syntax error occurs
↓
Node process exits
↓
Container stops automatically

---

# Important Infrastructure Understanding

Container lifecycle depends on:
main process lifecycle.

If main process stops:
container stops.

---

# Async Runtime Behavior Discovery

Observation:
Logs appeared in this order:

```plaintext
Server running on port 3000
MongoDB connected
```

Even though code called:

```js
connectDB();

app.listen();
```

with connectDB first.

---

# Root Cause

`connectDB()` is asynchronous.

Database connection starts in background.

Meanwhile Node.js continues execution immediately.

---

# Actual Runtime Flow

Start DB connection attempt
↓
Continue execution immediately
↓
Server starts listening
↓
Database connection completes later
↓
"MongoDB connected" log appears

---

# Important JavaScript Understanding

Execution order does not always equal completion order in asynchronous systems.

---

# Production-Safe Startup Pattern

Better approach:

```js
const startServer = async () => {

   await connectDB();

   app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
   });

};

startServer();
```

This ensures:
- DB becomes ready first
- server starts afterward

---

# Important Operational Understanding

Applications should ideally become healthy only after dependencies are ready.

Examples:
- databases
- caches
- message queues

This is important production engineering behavior.

---

# Key Infrastructure Learnings

- Docker Compose orchestrates multiple services together.
- Service names become internal DNS hostnames.
- Containers run immutable image snapshots.
- Images require rebuild after source changes.
- Container lifecycle depends on main process lifecycle.
- Compose manages stack-level orchestration.
- Async execution order differs from completion order.
- Real systems require dependency-aware startup behavior.

---

# Key Takeaway

Infrastructure engineering is not only about running containers.

It is about understanding:
- orchestration
- lifecycle management
- runtime behavior
- service dependencies
- networking
- startup sequencing
- immutable deployments