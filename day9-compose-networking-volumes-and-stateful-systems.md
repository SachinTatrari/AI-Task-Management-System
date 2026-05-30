# Day 9 - Docker Compose Networking, Volumes and Stateful Systems

## Objective

Deeply understand:
- Docker Compose internals
- service discovery
- internal networking
- environment variables
- persistent volumes
- stateful vs stateless systems
- orchestration behavior
- infrastructure storage concepts

This was one of the most important infrastructure engineering learning days so far.

---

# Docker Compose Deep Understanding

Current compose file:

```yaml
version: '3.9'

services:

  app:
    build: .

    ports:
      - "3007:3000"

    environment:
      - MONGO_URI=mongodb://mongo:27017/taskdb

    depends_on:
      - mongo

  mongo:
    image: mongo:7

    ports:
      - "27017:27017"

    volumes:
      - mongo-data:/data/db


volumes:
  mongo-data:
```

---

# Compose File Breakdown

---

## version: '3.9'

Defines Docker Compose specification version.

Used for:
- syntax compatibility
- feature support

---

## services:

Defines application services/containers participating in stack.

Each service usually represents:
- one container
- one responsibility

---

## app:

Defines backend application service.

Important realization:
Service name is NOT related to technology type.

`app:` does NOT mean Node.js automatically.

Could have been:

```yaml
backend:
banana:
my-service:
```

and system would still work.

---

# Important Understanding

Service names act as:
- orchestration identifiers
- internal network hostnames

NOT technology definitions.

Technology stack is actually determined by:
- Dockerfile
- base image

Example:

```dockerfile
FROM node:18
```

This defines Node.js runtime.

---

# Service Discovery and Internal Networking

One of the most important concepts learned.

---

# Initial Confusion

How does this work?

```plaintext
mongodb://mongo:27017/taskdb
```

Why does:
```plaintext
mongo
```

work like hostname?

---

# Important Understanding

Docker Compose automatically creates:
- internal network
- internal DNS system
- service discovery mechanism

---

# What Happens Internally

Compose creates mappings similar to:

```plaintext
mongo → 172.x.x.x
app   → 172.x.x.x
```

inside Docker network.

---

# Communication Flow

Node.js Container
↓
Requests hostname "mongo"
↓
Docker internal DNS resolves hostname
↓
Mongo container IP returned
↓
TCP connection established

---

# Important Realization

Service names automatically become:
INTERNAL DNS HOSTNAMES.

This only works:
inside Docker network.

---

# Why localhost Does NOT Work

Inside app container:

```plaintext
localhost
```

means:
THE APP CONTAINER ITSELF

NOT MongoDB container.

Containers are isolated environments.

---

# Big Infrastructure Understanding

Docker Compose provides:
SERVICE DISCOVERY

This becomes foundational later for:
- Kubernetes Services
- microservices
- distributed systems
- service meshes

---

# Environment Variables Deep Understanding

Compose file contains:

```yaml
environment:
  - MONGO_URI=mongodb://mongo:27017/taskdb
```

---

# Important Realization

`MONGO_URI` is NOT predefined keyword.

It is simply:
custom environment variable name.

Could have been:

```plaintext
BANANA_CONNECTION
DATABASE_URL
ANYTHING
```

---

# Why Use MONGO_URI

Convention/readability.

Represents:
MongoDB Connection URI.

---

# Breaking Down Connection String

```plaintext
mongodb://mongo:27017/taskdb
```

---

## mongodb://

MongoDB protocol identifier.

---

## mongo

Hostname.

Refers to:
MongoDB service container.

---

## 27017

MongoDB default port.

---

## taskdb

Database name.

Chosen manually.

Could have been:
- mydb
- productiondb
- anything else

MongoDB creates database automatically if missing.

---

# Important Confusion Resolved

Question:
Why does:

```js
process.env.MONGO_URI
```

work even though `.env` file does not contain `MONGO_URI`?

---

# Important Understanding

Environment variables can come from MANY sources:
- OS shell
- .env files
- Docker Compose
- Kubernetes
- CI/CD systems
- cloud providers

All eventually become available inside:

```js
process.env
```

---

# Current Runtime Flow

Docker Compose
↓
Injects MONGO_URI into container environment
↓
Node.js process starts
↓
process.env.MONGO_URI becomes available

---

# Important Realization

`.env` files are only ONE possible source of environment variables.

---

# Persistent Volumes

Compose file:

```yaml
volumes:
  - mongo-data:/data/db
```

---

# Breaking It Down

## Left Side

```plaintext
mongo-data
```

Docker-managed persistent volume.

---

## Right Side

```plaintext
/data/db
```

Internal path inside MongoDB container.

MongoDB stores actual database files there.

---

# What Happens Internally

MongoDB writes files to:

```plaintext
/data/db
```

Docker redirects storage into:
persistent Docker volume.

---

# Important Realization

Volume lifecycle is independent from container lifecycle.

Meaning:
- container can die
- data survives

---

# Volume Definition

At bottom of compose file:

```yaml
volumes:
  mongo-data:
```

Defines named volume globally.

---

# Important YAML Understanding

There are two separate concepts:

---

## Service-Level Volume Usage

```yaml
volumes:
  - mongo-data:/data/db
```

Means:
attach volume.

---

## Top-Level Volume Definition

```yaml
volumes:
  mongo-data:
```

Means:
create/manage volume resource.

---

# Debugging Session - Undefined Volume Error

Error:

```plaintext
service "mongo" refers to undefined volume mongo-data
```

---

# Root Cause

Volume was attached but not properly defined globally.

Important YAML indentation issue.

---

# Important Infrastructure Understanding

Compose separates:
- resource definition
- resource usage

Very common infrastructure design principle.

---

# Stateful vs Stateless Systems

One of the most important infrastructure concepts learned.

---

# What Is State?

State means:
important changing information remembered over time.

Examples:
- database records
- user sessions
- files
- messages

---

# Stateless Systems

Stateless systems:
do NOT permanently store important data internally.

Easy to:
- restart
- replace
- scale

---

# Example

Node.js backend container is mostly stateless.

If container dies:
new container can replace it easily.

---

# Stateful Systems

Stateful systems:
store important persistent data.

Examples:
- MongoDB
- PostgreSQL
- Redis
- Kafka

If storage disappears:
important data is lost.

---

# MongoDB Is Stateful

MongoDB stores:
- tasks
- documents
- database records

This data must persist.

---

# Why Volumes Matter

Without volume:

Container dies
↓
Filesystem disappears
↓
Database data lost

---

# With Volume

Container dies
↓
Volume survives
↓
Database survives

---

# Important Cloud-Native Principle

Modern systems try to keep:
COMPUTE STATELESS

and move state into:
EXTERNAL DURABLE STORAGE.

---

# Big Architecture Pattern

Stateless Compute Layer
↓
External Stateful Storage Layer

This is foundational cloud-native architecture.

---

# Real Infrastructure Parallel

| Cloud Concept | Docker Equivalent |
|---|---|
| EC2 Instance | Container |
| EBS Volume | Docker Volume |

---

# Important Lifecycle Commands

---

## Start Stack

```bash
docker compose up
```

---

## Background Mode

```bash
docker compose up -d
```

---

## Stop Containers

```bash
docker compose stop
```

Containers remain.

---

## Remove Stack

```bash
docker compose down
```

Removes:
- containers
- networks

BUT volumes survive.

---

## Remove Everything Including Data

```bash
docker compose down -v
```

Removes:
- containers
- networks
- volumes
- database data

Dangerous command.

---

# Key Infrastructure Learnings

- Service names become internal DNS hostnames.
- Containers communicate through Docker-managed virtual networks.
- Environment variables can come from many runtime sources.
- Volumes separate storage lifecycle from compute lifecycle.
- Stateful systems require persistent storage.
- Stateless systems are easier to scale and replace.
- Docker Compose performs orchestration and service discovery.
- Modern cloud systems separate compute from durable storage.

---

# Key Takeaway

Infrastructure engineering is fundamentally about:
- networking
- orchestration
- runtime environments
- service communication
- persistence
- lifecycle management
- distributed systems thinking