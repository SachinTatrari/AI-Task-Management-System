# Day 11 - Docker Networking and Service Discovery

## Objective

Understand:

- Docker networks
- container networking
- network namespaces
- service discovery
- DNS resolution
- host vs container communication
- port publishing
- Linux hostname resolution
- Docker internal DNS

This was one of the most important networking and infrastructure lessons so far.

---

# Big Picture

Current architecture:

Browser
↓
Host Machine
↓
Docker Network
↓
App Container
↓
Mongo Container

Containers communicate internally through Docker networking.

Host communicates with containers through port mappings.

---

# Docker Networks

Command:

```bash
docker network ls
```

Shows all available Docker networks.

Examples:

- bridge
- host
- none
- compose-created networks

---

# Compose Network

Docker Compose automatically creates:

```plaintext
<project-name>_default
```

Example:

```plaintext
ai-task-management-system_default
```

This network acts like a private LAN for containers.

---

# Important Realization

The network is NOT:

- app
- mongo

Those are services.

Instead:

Network
↓
contains
↓
Containers

Similar to:

Office Building
↓
contains
↓
Employees

---

# Container Network Namespaces

Each container has:

- its own processes
- its own filesystem
- its own network stack
- its own localhost

Example:

App Container
localhost

Mongo Container
localhost

Both localhost values are different.

---

# Why localhost Does Not Work

Inside app container:

```plaintext
localhost
```

means:

App Container Itself

NOT MongoDB.

Therefore:

```plaintext
mongodb://localhost:27017
```

fails.

---

# Service Discovery

Compose file:

```yaml
services:
  app:
  mongo:
```

Docker automatically creates:

- internal network
- DNS service
- hostname mappings

---

# Internal DNS Mapping

Conceptually:

```plaintext
mongo → 172.x.x.x
app → 172.x.x.x
```

Docker DNS maintains these mappings.

---

# Why Use Service Names Instead Of IP Addresses

Current:

```plaintext
mongodb://mongo:27017/taskdb
```

Alternative:

```plaintext
mongodb://172.20.0.3:27017/taskdb
```

---

# Why IP Addresses Are Bad

Container IPs are dynamic.

Today:

```plaintext
mongo → 172.20.0.3
```

Tomorrow:

```plaintext
mongo → 172.20.0.8
```

after recreation.

Hardcoded IPs would break.

---

# Service Names Are Stable

Even if IP changes:

```plaintext
mongo
```

always points to current container IP.

Applications depend on:

SERVICE IDENTITY

not

SERVICE LOCATION.

---

# Infrastructure Principle

Applications should care about:

WHAT

Infrastructure should handle:

WHERE

---

# Service Discovery Exists Everywhere

Docker Compose:

```plaintext
mongo
```

Kubernetes:

```plaintext
mongo-service
```

Microservices:

```plaintext
auth-service
payment-service
```

Cloud Platforms:

Internal DNS names

Same principle everywhere.

---

# Internal Container Communication

App Container
↔
Mongo Container

uses:

Docker Internal Network

No host involvement required.

---

# Port Publishing

Compose:

```yaml
ports:
  - "3007:3000"
```

Meaning:

Host Port
↓
3007

Container Port
↓
3000

---

# Important Understanding

Port publishing exists for:

HOST ↔ CONTAINER

communication.

Not for:

CONTAINER ↔ CONTAINER

communication.

---

# Host To Container Flow

Browser
↓
localhost:3007
↓
Docker NAT
↓
App Container:3000

---

# Container To Container Flow

App Container
↓
app:3000
↓
Internal Docker Network

Host machine not involved.

---

# Question Answered

If:

```yaml
ports:
```

is removed from app service,

will Mongo still connect?

YES.

Because containers communicate internally.

---

# What Stops Working?

Browser access.

Example:

```plaintext
localhost:3007
```

will fail.

Because host no longer has a published path to container.

---

# Database Exposure

Current compose exposes:

```yaml
ports:
  - "27017:27017"
```

Meaning:

Host Machine
↓
Mongo Container

Direct access becomes possible.

---

# Production Best Practice

Databases are usually NOT exposed publicly.

Instead:

Internet
↓
Load Balancer
↓
Backend API
↓
Database

Database remains private.

---

# Why Ping Was Missing

Inside app container:

```bash
ping
```

was not available.

Reason:

Minimal images intentionally remove tools.

Benefits:

- smaller images
- lower attack surface
- faster downloads

---

# Linux Hostname Resolution

Important files:

```plaintext
/etc/hosts
/etc/resolv.conf
```

---

# /etc/hosts

Acts like a local phonebook.

Example:

```plaintext
127.0.0.1 localhost
```

Hostname
↓
IP address

Linux checks this first.

---

# /etc/resolv.conf

Contains DNS server information.

Purpose:

"If hostname isn't found locally,
which DNS server should I ask?"

---

# Docker Embedded DNS

Inside containers,

Docker provides an internal DNS server.

Conceptually:

```plaintext
mongo → container IP
app → container IP
```

---

# DNS Resolution Flow

Node Application
↓
Linux Resolver
↓
/etc/hosts
↓
Not Found
↓
/etc/resolv.conf
↓
Docker DNS
↓
mongo → 172.x.x.x
↓
TCP Connection Established
↓
MongoDB

---

# Key Networking Principle

Containers communicate using:

Service Names

NOT

IP Addresses.

---

# Host Networking And Internal Networking Are Separate

Host Access:

```plaintext
localhost:3007
```

requires:

```yaml
ports:
```

Internal Access:

```plaintext
app:3000
mongo:27017
```

requires:

Docker network only.

---

# Major Infrastructure Learnings

- Containers have isolated network namespaces.
- Every container has its own localhost.
- Compose creates private networks automatically.
- Service names become DNS hostnames.
- IP addresses are dynamic.
- Service names provide stable identity.
- Port publishing is only for host access.
- Containers communicate internally without host involvement.
- Databases should usually remain private.
- Docker provides embedded DNS.
- Linux hostname resolution uses /etc/hosts and /etc/resolv.conf.
- Service discovery is fundamental to distributed systems.

---

# Key Takeaway

Infrastructure engineers do not think:

"What IP should I connect to?"

They think:

"Which service should I connect to?"

Infrastructure handles the rest.

This same principle appears later in:

- Kubernetes
- Microservices
- Service Meshes
- AWS Networking
- Cloud-Native Systems

Understanding service discovery is one of the foundational skills of infrastructure engineering.