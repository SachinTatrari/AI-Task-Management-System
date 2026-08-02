# Kubernetes - Day 2
# kubelet, containerd & The Journey of a Pod from Pending to Running

> **Objective**
>
> Understand what happens after the Scheduler assigns a Pod to a Worker Node.
>
> By the end of this session we should be able to answer:
>
> **"How does a Pod actually go from Pending to Running?"**

---

# Revision from Day 1

Yesterday we learnt that the Scheduler selects the best Worker Node.

Example:

```
Scheduler

↓

Worker Node 2 selected
```

But a question immediately arises.

> How does Worker Node 2 know that it has been assigned a Pod?

The Scheduler doesn't SSH into the machine.

It doesn't execute Docker commands.

It doesn't remotely create containers.

Something running on Worker Node 2 has to receive this assignment and execute it.

That component is **kubelet**.

---

# What is kubelet?

Every Worker Node runs exactly one kubelet.

Think of kubelet as the **local manager** of that Worker Node.

```
Worker Node

+--------------------------------+
|                                |
| kubelet                        |
|                                |
| containerd                     |
|                                |
| kube-proxy                     |
|                                |
| Pods                           |
|                                |
+--------------------------------+
```

The kubelet's primary responsibility is:

> **Ensure that the Pods assigned to this Worker Node are actually running.**

Notice the wording carefully.

It does **not** decide where Pods should run.

That decision has already been made by the Scheduler.

---

# Why Doesn't the Scheduler Do Everything?

Initially it may seem easier if the Scheduler itself:

- Created containers
- Monitored containers
- Restarted failed containers
- Pulled images

But imagine a Kubernetes cluster containing:

```
10,000 Worker Nodes
```

If the Scheduler had to monitor every container running inside every Worker Node, it would become the bottleneck of the cluster.

Instead Kubernetes follows one of its biggest design principles:

> **Distributed Responsibility**

The Scheduler makes **global decisions**.

The kubelet performs **local execution**.

---

# Analogy

Imagine a company.

```
CEO

↓

Team Manager

↓

Employees
```

The CEO decides:

> "Sachin should work on Project Alpha."

Does the CEO then check:

- Whether your laptop is working?
- Whether you're still coding?
- Whether your application crashed?

No.

That responsibility belongs to your Team Manager.

Exactly the same principle exists in Kubernetes.

The Scheduler is like the CEO.

The kubelet is like the local Team Manager.

---

# Life Without kubelet

Suppose the Scheduler assigns:

```
Task API

↓

Worker Node 2
```

But no kubelet exists.

What happens?

Nothing.

Nobody is present on Worker Node 2 to execute the assignment.

The Pod remains Pending forever.

This is why every Worker Node requires its own kubelet.

---

# First Principle

Every distributed system separates decision making from execution.

```
Control Plane

↓

Makes decisions

↓

Worker Nodes

↓

Execute those decisions
```

The kubelet is the execution component of every Worker Node.

---

# Does kubelet Create Containers?

No.

This is another common misconception.

Many beginners think:

```
Scheduler

↓

kubelet

↓

Container Created
```

This is incorrect.

The kubelet does **not** know how to create Linux containers.

It doesn't know how to:

- Pull images
- Create namespaces
- Configure cgroups
- Mount overlay filesystems

Its responsibility is only:

> "Ensure this Pod is running."

So another component is needed.

---

# Enter containerd

containerd is called a **Container Runtime**.

Its responsibilities include:

- Pulling container images
- Unpacking images
- Creating containers
- Starting containers
- Stopping containers
- Deleting containers

Think of containerd as the actual worker that knows how to communicate with the Linux kernel.

---

# Docker vs containerd

When we previously studied Docker, we learned:

```
docker run nginx
```

Two things happen.

1. Pull image (if necessary)

2. Create and run the container

Interestingly...

Modern Kubernetes does **not** require Docker.

Instead it talks directly to containerd.

The flow becomes:

```
Scheduler

↓

Assign Pod

↓

kubelet

↓

containerd

↓

Container Running
```

Docker contains many features such as:

- docker build
- docker push
- docker login

Kubernetes doesn't need those.

Images are already built during CI/CD.

Kubernetes only needs something capable of running containers.

That is why containerd is enough.

---

# Analogy

Imagine constructing a building.

```
Architect

↓

Site Manager

↓

Construction Workers
```

Architect → Scheduler

Site Manager → kubelet

Construction Workers → containerd

The Site Manager doesn't lay bricks.

He simply tells the workers what needs to be built.

Similarly, kubelet tells containerd what containers need to be started.

---

# What Happens if the Image Doesn't Exist?

Suppose the Deployment contains:

```yaml
image: ghcr.io/sachin/task-api:v1
```

The Scheduler assigns the Pod.

The kubelet asks containerd to run it.

containerd checks:

```
Do I already have this image?
```

Two possibilities exist.

---

## Case 1

Image already exists.

```
Image Found

↓

Create Container

↓

Run Container
```

No network communication is required.

---

## Case 2

Image missing.

```
Image Missing

↓

Pull Image

↓

Unpack Image

↓

Create Container

↓

Run Container
```

Exactly the same behaviour we previously studied with Docker.

---

# Private Registries

Suppose the image is stored inside a private registry.

containerd attempts:

```
Pull Image
```

The registry replies:

```
401 Unauthorized
```

containerd cannot magically access private images.

Kubernetes later solves this using **imagePullSecrets**.

(We will study this in a future session.)

---

# The Watch Mechanism

Now another question arises.

How does kubelet even know a Pod has been assigned?

Does the Scheduler contact kubelet?

No.

Does the API Server SSH into Worker Nodes?

No.

Instead Kubernetes uses a **Watch mechanism**.

Think of it as subscribing to notifications.

The kubelet tells the API Server:

> "Notify me whenever Pods assigned to my Worker Node change."

When the Scheduler updates the Pod assignment inside the API Server:

```
Pod A

↓

Worker Node 2
```

The API Server immediately notifies the kubelet that is already watching.

The kubelet then starts reconciliation.

---

# Why Doesn't Kubernetes Use Push?

Imagine:

```
API Server

↓

10,000 Worker Nodes
```

If the API Server had to actively push updates to every Worker Node:

- Huge network traffic
- Thousands of active connections
- Central bottleneck
- Complex retry logic

Instead each kubelet initiates the watch.

This distributes the workload across the cluster.

---

# Pod Creation Flow

The complete flow now becomes:

```
kubectl apply

↓

API Server

↓

etcd

↓

Deployment Controller

↓

Scheduler

↓

Pod assigned to Worker Node

↓

kubelet receives update

↓

containerd

↓

Pull Image

↓

Create Container

↓

Run Container

↓

Pod Running
```

---

# Image Pull Failure

Suppose the registry becomes unavailable.

containerd attempts:

```
Pull Image

↓

Failed
```

Question:

Who should retry?

Not the Scheduler.

Not the API Server.

Not containerd.

The answer is:

**kubelet**

Why?

Because kubelet's responsibility is:

> Ensure the assigned Pod eventually reaches the desired state.

containerd simply reports:

> "I couldn't pull the image."

The kubelet updates the Pod status and later retries.

---

# Desired State in Action

Desired State:

```
Pod

↓

Running
```

Current State:

```
Image Pull Failed
```

The two states differ.

Therefore the kubelet continues attempting reconciliation until either:

- The image is successfully pulled
- The Pod specification changes
- The Pod is deleted

This is Kubernetes' declarative model in action.

---

# Responsibilities Summary

| Component | Responsibility |
|-----------|----------------|
| Scheduler | Select Worker Node |
| kubelet | Ensure assigned Pods are running |
| containerd | Pull images and run containers |
| API Server | Store and expose cluster state |
| etcd | Persist cluster data |

---

# Common Misconceptions

❌ kubelet creates Linux containers.

✅ containerd creates Linux containers.

---

❌ Scheduler starts containers.

✅ Scheduler only assigns Pods to Worker Nodes.

---

❌ containerd retries forever if image pulling fails.

✅ containerd reports the failure. kubelet decides when to retry.

---

❌ Kubernetes requires Docker.

✅ Kubernetes only requires a compatible container runtime such as containerd.

---

# Interview Questions

### Why doesn't Kubernetes need Docker?

Docker is primarily a developer tool containing many capabilities such as building and pushing images.

Kubernetes only requires a container runtime capable of running containers.

Modern Kubernetes commonly uses containerd directly.

---

### What is kubelet?

A node agent running on every Worker Node that ensures Pods assigned to that node are actually running.

---

### What is containerd?

A container runtime responsible for pulling images and creating/running containers.

---

### Who retries if an image pull fails?

The kubelet.

The desired state still requires the Pod to be running, so kubelet continues reconciliation by asking containerd to try again later.

---

# Today's Learning Summary

Today we completed the execution side of Kubernetes.

We now understand the complete chain:

```
Scheduler

↓

kubelet

↓

containerd

↓

Linux

↓

Running Container
```

This completes the journey of a Pod from **Pending** to **Running**.

The only remaining topic related to Worker Node communication is **Heartbeats**, which we will begin in Day 3 before moving deeper into ReplicaSets and Deployments.