# Kubernetes - Day 1
## From Docker Containers to Kubernetes Architecture

> **Objective:** Build a strong mental model of Kubernetes before writing YAML files or using `kubectl`.

---

# 1. Why Kubernetes?

Docker is an excellent containerization platform. It allows us to package applications along with all their dependencies into portable containers.

With Docker we can:

- Build container images
- Run containers
- Share applications consistently across environments

Example:

```bash
docker run nginx
```

This works perfectly for a few containers.

However, real production environments introduce new challenges:

- Hundreds or thousands of containers
- Multiple servers
- Automatic recovery when applications fail
- Scaling applications during high traffic
- Zero-downtime deployments
- Load balancing user requests

Docker by itself does not solve these orchestration problems.

**Docker runs containers. Kubernetes orchestrates containers.**

---

# 2. What is Container Orchestration?

Container orchestration is the automated management of containers throughout their lifecycle.

Instead of manually starting, stopping, restarting and scaling containers, Kubernetes performs these tasks automatically.

### Restaurant Analogy

Imagine a restaurant.

The cooks prepare food.

But someone must:

- Assign orders
- Replace absent cooks
- Open another kitchen when customers increase
- Ensure every customer receives food

Docker is like the cooks.

Kubernetes is the restaurant manager.

---

# 3. Declarative vs Imperative

## Imperative

You tell the system every step.

Example:

- Start a container.
- Restart it if it crashes.
- Create another one.

You are responsible for managing everything.

## Declarative

You simply declare the final goal.

Example:

> "I want three replicas of my application."

Kubernetes figures out **how** to achieve that goal.

---

# 4. Desired State vs Current State

Kubernetes continuously compares two states.

### Desired State

What should exist.

Example:

- Task API
- Replicas = 3

### Current State

What actually exists.

Example:

- Task API
- Replicas = 2

Kubernetes constantly works to make:

```
Current State
      ↓
Desired State
```

This continuous comparison is called the **Reconciliation Loop**.

### Mental Model

Think of a thermostat.

You set the desired temperature.

If the room temperature changes, the thermostat continuously corrects it.

Kubernetes behaves in exactly the same way.

---

# 5. Kubernetes Cluster

A Kubernetes Cluster is a collection of machines working together.

Logical Architecture:

```
                Kubernetes Cluster

              Control Plane

        /          |          \

 Worker 1      Worker 2      Worker 3
```

The Control Plane manages the cluster.

Worker Nodes run applications.

---

# 6. Physical vs Logical Architecture

Suppose AWS provides three Virtual Machines.

```
VM1
VM2
VM3
```

After installing Kubernetes:

```
VM1 → Control Plane Node

VM2 → Worker Node

VM3 → Worker Node
```

A Worker Node is simply a machine that has joined the Kubernetes cluster.

The Control Plane is a separate machine responsible for managing the cluster.

---

# 7. Control Plane

The Control Plane is the brain of Kubernetes.

Responsibilities include:

- Maintaining cluster state
- Running controllers
- Scheduling workloads
- Providing the Kubernetes API

Applications do **not** run on the Control Plane.

---

# 8. Worker Nodes

Worker Nodes execute application workloads.

They contain components such as:

- kubelet
- containerd
- kube-proxy
- Pods

These components will be explored in detail during the next learning session.

---

# 9. Pods

A Pod is the smallest deployable unit in Kubernetes.

Although containers execute applications, Kubernetes schedules Pods.

A Pod usually contains one container but can also contain multiple tightly coupled containers that share:

- Network
- Storage
- Lifecycle

Pods are atomic. Kubernetes never splits containers from the same Pod across different Worker Nodes.

---

# 10. Scheduler

The Scheduler decides **which Worker Node** should run a Pending Pod.

It considers:

- CPU
- Memory
- Storage
- Scheduling rules

The Scheduler:

- ✔ Assigns Pods to Worker Nodes.
- ✘ Does not create Pods.
- ✘ Does not run containers.

---

# 11. API Server

The API Server is the single entry point into Kubernetes.

Every major component communicates through it.

Responsibilities:

- Authentication
- Authorization
- Validation
- Persisting cluster objects

---

# 12. etcd

etcd is Kubernetes' distributed key-value database.

It stores the desired state of the entire cluster.

Examples include:

- Pods
- Deployments
- Services
- Nodes

---

# 13. Controller Manager

The Controller Manager contains multiple controllers.

Examples:

- Deployment Controller
- Node Controller
- Job Controller

Each controller continuously compares the desired state with the current state and attempts to reconcile differences.

---

# 14. Failure Scenarios

### Container Failure

The kubelet restarts the failed container.

### Pod Failure

The Deployment Controller requests a replacement Pod.

### Worker Node Failure

The Node Controller detects the failed node.

Replacement Pods are scheduled onto healthy Worker Nodes if capacity exists.

---

# Key Takeaways

- Docker packages applications; Kubernetes manages them.
- Kubernetes follows a declarative model.
- The Control Plane manages the cluster.
- Worker Nodes execute workloads.
- Pods are the smallest deployable unit.
- The Scheduler places Pods onto Worker Nodes.
- The API Server is the front door of Kubernetes.
- etcd stores the cluster's desired state.
- Controllers continuously reconcile desired and current state.
