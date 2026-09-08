# Day 9 — Kubernetes Resource Requests, Limits & QoS

## 1. Day 9 Goal

Day 9 focused on how Kubernetes manages CPU and memory resources for Pods:

- Resource requests
- Resource limits
- CPU and memory units
- How the Scheduler uses requests
- CPU throttling
- Memory limits and OOM killing
- Container-level resource configuration
- Pod-level effective resource requests
- Node Capacity vs Allocatable
- Resource overcommitment
- The rule: **a limit is not a reservation**
- Kubernetes QoS classes:
  - Guaranteed
  - Burstable
  - BestEffort
- QoS and protection during resource pressure
- Deployment/ReplicaSet/Pod investigation performed during the lesson

---

# 2. Why Resource Requests Exist

We already learned that the Kubernetes Scheduler decides which Worker Node should run a Pod.

The Scheduler needs information about how much CPU and memory a Pod requires so it can determine whether that Pod can fit on a node.

For example:

```text
Worker A
CPU available for Pods = 2 CPU

Worker B
CPU available for Pods = 1 CPU
```

A Pod requesting:

```text
1500m CPU
```

cannot fit on Worker B based on its CPU request, but can potentially fit on Worker A.

Therefore:

> **Resource requests primarily help Kubernetes with scheduling.**

---

# 3. Resource Requests

A request tells Kubernetes:

> "This workload needs approximately this much resource for scheduling/resource accounting purposes."

Example:

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "256Mi"
```

This means:

```text
CPU request    = 500m = 0.5 CPU
Memory request = 256Mi
```

The Scheduler considers requests when deciding whether the Pod can fit on a node.

---

# 4. Resource Limits

A limit tells Kubernetes:

> "This container should not be allowed to use more than this configured amount."

Example:

```yaml
resources:
  limits:
    cpu: "1"
    memory: "512Mi"
```

Meaning:

```text
CPU limit      = 1 CPU
Memory limit   = 512Mi
```

The core mental model is:

```text
REQUEST → scheduling
LIMIT   → runtime boundary
```

A request is not a maximum.

A limit is not a reservation.

That last statement is one of the most important lessons from Day 9.

---

# 5. Complete Resource Example

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "256Mi"
  limits:
    cpu: "1"
    memory: "512Mi"
```

Interpretation:

```text
Scheduling:
    CPU request    = 0.5 CPU
    Memory request = 256Mi

Runtime boundaries:
    CPU limit      = 1 CPU
    Memory limit   = 512Mi
```

A container can use more than its request if resources are available, as long as it stays within its configured limits.

For example:

```text
CPU request = 500m
Actual CPU usage = 300m
CPU limit = 1 CPU
```

This is perfectly valid.

Therefore:

> **Request ≠ current usage**

and:

> **Request ≠ maximum usage**

---

# 6. CPU Units

Kubernetes commonly represents CPU in millicores.

The key conversion is:

```text
1000m = 1 CPU
```

Therefore:

```text
500m = 0.5 CPU
250m = 0.25 CPU
100m = 0.1 CPU
50m  = 0.05 CPU
```

Example:

```yaml
cpu: "100m"
```

means:

```text
0.1 CPU
```

---

# 7. Memory Units

Common Kubernetes memory units include:

```text
Ki
Mi
Gi
```

Examples:

```yaml
memory: "128Mi"
memory: "256Mi"
memory: "1Gi"
```

Practical interpretation:

```text
128Mi → 128 MiB
256Mi → 256 MiB
1Gi   → 1 GiB
```

---

# 8. Requests vs Actual Usage

Suppose:

```yaml
requests:
  cpu: "500m"

limits:
  cpu: "1"
```

The application might currently be using only:

```text
100m
```

The request is still:

```text
500m
```

The request is the declared scheduling/resource-accounting value, not a live measurement.

So:

```text
Declared request
       ≠
Current instantaneous usage
```

The same principle applies to limits.

---

# 9. What Happens When CPU Goes Above the Request?

Suppose:

```text
CPU request = 100m
CPU limit   = 500m
```

The container is allowed to use more than 100m when CPU is available.

For example:

```text
Actual usage = 300m
```

is allowed because:

```text
300m > 100m request
300m < 500m limit
```

This is why requests should not be thought of as hard runtime ceilings.

---

# 10. What Happens When CPU Hits the Limit?

CPU and memory behave differently.

When CPU usage tries to exceed the configured CPU limit, Kubernetes can enforce that limit through CPU throttling.

Mental model:

```text
Container uses CPU
       ↓
CPU usage reaches limit
       ↓
Further CPU consumption is throttled
```

So:

> **CPU limit exceeded → throttling**

The container is not normally killed merely because it reaches its CPU limit.

---

# 11. What Happens When Memory Hits the Limit?

Memory is different.

If a container exceeds its memory limit, it can be terminated by the kernel through an OOM (Out Of Memory) kill.

Conceptually:

```text
Container uses memory
       ↓
Memory usage increases
       ↓
Memory limit exceeded
       ↓
Possible OOM kill
       ↓
Container exits
       ↓
Kubelet may restart it according to Pod restart behavior
```

Therefore the simplified mental model is:

```text
CPU limit exceeded
    → throttling

Memory limit exceeded
    → possible OOM kill
```

---

# 12. Resources Are Configured at the Container Level

Resource configuration appears under each container:

```yaml
spec:
  containers:
    - name: task-api
      image: ai-task-management-system-app:latest
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "500m"
          memory: "256Mi"
```

This is important because requests and limits are configured for individual containers.

However, Kubernetes still schedules the **whole Pod**, not individual containers.

---

# 13. Multiple Containers in One Pod

Suppose a Pod has:

```text
Container A
CPU request = 100m

Container B
CPU request = 200m
```

The effective CPU request for scheduling is:

```text
100m + 200m = 300m
```

The important connection to earlier Kubernetes lessons is:

> **The Scheduler schedules whole Pods, never individual containers.**

It does not do:

```text
Container A → Worker 1
Container B → Worker 2
```

The Pod is the scheduling unit.

---

# 14. Node Capacity vs Allocatable

A Worker Node exposes resource information including:

```text
Capacity
Allocatable
```

## Capacity

Capacity represents the node's total resource capacity.

Example:

```text
CPU capacity = 2 CPU
Memory capacity = 4Gi
```

## Allocatable

Allocatable represents the resources Kubernetes makes available for Pods after accounting for resources needed/reserved by the node and system components.

Conceptually:

```text
Node / VM resources
       ↓
System/node reservations
       ↓
Allocatable
       ↓
Resources available to Pods
```

Therefore:

> **The Scheduler reasons about resources available for Pods, not simply raw hardware capacity.**

Useful commands:

```powershell
kubectl get nodes
kubectl describe node <node-name>
```

When describing a node, useful sections include:

```text
Capacity
Allocatable
Requests
Limits
```

---

# 15. Resource Overcommitment

Kubernetes can schedule workloads whose **total limits** are greater than a node's capacity, as long as their **requests** fit.

Example:

```text
Node allocatable = 2 CPU
```

Ten Pods:

```text
Each request = 100m
Each limit   = 1 CPU
```

Total requests:

```text
10 × 100m
= 1000m
= 1 CPU
```

Total limits:

```text
10 × 1 CPU
= 10 CPU
```

So:

```text
Node allocatable = 2 CPU
Total requests   = 1 CPU
Total limits     = 10 CPU
```

The Scheduler can place these Pods based on their requests.

But if all ten Pods suddenly demand their maximum:

```text
Demand = 10 CPU
Available = 2 CPU
```

there is not enough physical CPU to satisfy everyone simultaneously.

CPU contention and throttling can occur.

This is **resource overcommitment**.

---

# 16. Important Correction About "Remaining CPU"

We discussed an example with:

```text
2 CPU allocatable
```

and Pods requesting:

```text
100m each
```

If 10 Pods are scheduled:

```text
10 × 100m = 1 CPU
```

It is tempting to say:

> "1 CPU is physically unused."

That wording is not necessarily correct.

A better statement is:

> **There is 1 CPU of remaining scheduling/request capacity based on declared requests.**

Actual CPU usage can be very different.

For example, those Pods might collectively be using:

```text
200m
```

or:

```text
1500m
```

depending on their workloads.

Therefore:

```text
Request capacity
       ≠
Actual instantaneous usage
```

---

# 17. The Most Important Rule: A Limit Is Not a Reservation

Consider:

```text
Node allocatable = 2 CPU

Pod A:
    request = 100m
    limit   = 1 CPU

Pod B:
    request = 100m
    limit   = 1 CPU
```

For scheduling, Kubernetes considers the requests:

```text
100m + 100m = 200m
```

It does not treat the limits as already-reserved CPU:

```text
1 CPU + 1 CPU
```

Therefore:

> **A limit is not a reservation.**

This is one of the central concepts behind Kubernetes resource overcommitment.

---

# 18. QoS Classes

Kubernetes assigns Pods a Quality of Service (QoS) class based on resource configuration.

The three classes are:

```text
Guaranteed
Burstable
BestEffort
```

QoS becomes particularly important when Kubernetes is dealing with resource pressure.

---

# 19. BestEffort

A Pod with no CPU or memory requests/limits configured falls into BestEffort.

Example:

```yaml
containers:
  - name: task-api
    image: ai-task-management-system-app:latest
```

There is no:

```yaml
resources:
```

Therefore there are no declared CPU/memory requests or limits.

Mental model:

> **BestEffort = no declared resource requests or limits.**

Under severe resource pressure, BestEffort workloads are generally the least protected.

---

# 20. Burstable

A Pod is Burstable when resources are configured but it does not meet the conditions for Guaranteed QoS.

Example:

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "256Mi"
```

Here:

```text
CPU:
    request = 100m
    limit   = 500m

Memory:
    request = 128Mi
    limit   = 256Mi
```

The requests and limits differ, so this is not Guaranteed.

It is:

```text
Burstable
```

Mental model:

> **Burstable = I have declared resource expectations and limits, but I can burst above my requests up to my limits.**

---

# 21. Guaranteed

A Pod can be Guaranteed when the relevant containers have CPU and memory requests and limits configured appropriately, with requests matching limits.

Example:

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "256Mi"
```

Notice:

```text
CPU:
    request = 500m
    limit   = 500m

Memory:
    request = 256Mi
    limit   = 256Mi
```

The requests and limits match.

For the Day 9 examples, this is the Guaranteed pattern.

Mental model:

> **Guaranteed = resources are explicitly and tightly defined.**

---

# 22. QoS Protection Mental Model

Under severe memory pressure, a useful simplified mental model is:

```text
Guaranteed
    ↓
strongest protection

Burstable
    ↓
middle

BestEffort
    ↓
weakest protection
```

But this must NOT be interpreted as:

```text
Guaranteed = can never be evicted
BestEffort = always evicted first
```

Actual Kubernetes eviction behavior considers additional factors, including resource usage relative to requests and other mechanisms.

Therefore:

> **QoS provides a protection hierarchy, not an absolute survival guarantee.**

---

# 23. Day 9 QoS Challenge

We analyzed:

## Pod A

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "256Mi"
```

## Pod B

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "256Mi"
```

## Pod C

```yaml
# no resources section
```

### Question 1 — Pod A

Answer:

```text
Guaranteed
```

CPU and memory both have requests and limits, and they match.

### Question 2 — Pod B

Answer:

```text
Burstable
```

Resources are configured, but requests and limits differ.

### Question 3 — Pod C

Answer:

```text
BestEffort
```

No requests or limits are configured.

### Question 4 — Severe Memory Pressure

If all three Pods consume:

```text
400Mi
```

then, under the simplified model, Pod C is generally the least protected.

```text
Pod A → Guaranteed → strongest protection
Pod B → Burstable   → middle
Pod C → BestEffort  → weakest
```

---

# 24. Correction to the Eviction Reasoning

The initial reasoning considered eliminating Pod A because it was already at its limit, and Pod B because its limit was also reached.

That is not the correct way to reason about eviction.

A limit does not by itself determine eviction priority.

Instead think:

```text
Resource pressure
       ↓
Kubernetes evaluates workloads
       ↓
QoS + resource usage relative to requests + other factors
       ↓
Eviction decision
```

So the correct Day 9 answer is:

```text
C = generally least protected
```

because it is BestEffort.

The important distinction is:

```text
Limit
  ≠
Eviction priority
```

---

# 25. "What If Pod C Handles Crucial Data?"

This was an important real-world consideration.

A workload being business-critical does not automatically make it immune from Kubernetes eviction.

Production systems use additional workload architecture and Kubernetes mechanisms to protect important workloads.

The Day 9 takeaway is:

> **QoS is only one part of workload protection.**

Do not reduce Kubernetes eviction to:

```text
BestEffort → always killed
Guaranteed → never killed
```

That is too simplistic.

---

# 26. Resource Configuration for Our `task-api`

A reasonable resource configuration for our project is:

```yaml
containers:
  - name: task-api
    image: ai-task-management-system-app:latest
    imagePullPolicy: IfNotPresent
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "256Mi"
    ports:
      - containerPort: 3000
```

Interpretation:

```text
Scheduling request:
    CPU    = 100m
    Memory = 128Mi

Runtime limits:
    CPU    = 500m
    Memory = 256Mi
```

Because the requests and limits differ, this configuration produces a **Burstable** QoS class.

---

# 27. Kustomize Interaction

Our project uses:

```text
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── mongo-deployment.yaml
│   ├── mongo-service.yaml
│   ├── mongo-pvc.yaml
│   └── kustomization.yaml
│
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml
    │   └── .env.secret
    │
    └── prod/
        ├── kustomization.yaml
        └── .env.secret
```

A common change in the base can flow into overlays unless an overlay overrides it.

Preview Dev:

```powershell
kubectl kustomize overlays/dev
```

Apply Dev:

```powershell
kubectl apply -k overlays/dev
```

Compare that with:

```powershell
kubectl apply -f deployment.yaml
```

The latter applies the raw manifest directly and therefore bypasses Kustomize overlay transformations.

---

# 28. `kubectl apply` Is Not the Same as a Rollout

`kubectl apply` means:

> Apply this desired configuration.

A rollout occurs when the Deployment's **Pod template** changes.

Conceptually:

```text
kubectl apply
      ↓
Deployment configuration
      ↓
Did the Pod template change?
      │
      ├── No → no new ReplicaSet
      │
      └── Yes
           ↓
        New ReplicaSet
           ↓
        New Pods
```

Therefore:

> **`kubectl apply` ≠ rollout.**

Changing resources under:

```yaml
spec:
  template:
    spec:
      containers:
```

changes the Pod template and can therefore trigger a new ReplicaSet/rollout.

But only if the actual configuration being applied differs from the current Pod template.

---

# 29. ReplicaSet Age vs Pod Age

During Day 9 we observed:

- Three healthy `task-api` Pods
- The healthy Pods shared ReplicaSet hash `75f5fdc4cf`
- Some Pods were much newer than the ReplicaSet
- One failed Pod had `CreateContainerConfigError`
- The failed Pod belonged to a different ReplicaSet hash

This led to an important distinction:

> **ReplicaSet age is not Pod age.**

For example:

```text
ReplicaSet created 11 days ago
        │
        ├── Pod created 11 days ago
        ├── Pod recreated 26 hours ago
        └── Pod recreated 26 hours ago
```

A ReplicaSet's job is to maintain the desired number of Pods.

If one disappears:

```text
Desired = 3
Current = 2
```

the ReplicaSet creates a replacement.

Therefore an old ReplicaSet can manage newly recreated Pods.

---

# 30. Deployment → ReplicaSet → Pod

The hierarchy is:

```text
Deployment
    ↓
ReplicaSet
    ↓
Pods
    ↓
Containers
```

Responsibilities:

```text
Deployment
    → manages rollout/revision history and ReplicaSets

ReplicaSet
    → maintains the desired number of Pods

Pod
    → scheduling/lifecycle unit containing containers
```

This connects directly to Kubernetes' reconciliation model.

---

# 31. Failed Pod Ownership Investigation

The failed Pod had an owner reference pointing to a ReplicaSet:

```json
[
  {
    "apiVersion": "apps/v1",
    "blockOwnerDeletion": true,
    "controller": true,
    "kind": "ReplicaSet",
    "name": "task-api-69f787f858",
    "uid": "255d35e2-3ad7-4e0a-b122-13a902f1090c"
  }
]
```

The important debugging lesson was how to trace ownership upward:

```text
Pod
 ↓
Owner Reference
 ↓
ReplicaSet
 ↓
Deployment
```

Useful commands:

```powershell
kubectl get rs
```

Then inspect a specific ReplicaSet:

```powershell
kubectl get rs task-api-69f787f858
```

And inspect the failed Pod:

```powershell
kubectl describe pod <failed-pod-name>
```

For errors such as:

```text
CreateContainerConfigError
```

the **Events** section of `kubectl describe pod` is especially useful.

---

# 32. Day 9 Debugging Mental Model

When a Pod behaves unexpectedly, don't immediately assume the Pod specification is the whole story.

Trace:

```text
Deployment
    ↓
ReplicaSet
    ↓
Pod
    ↓
Container
```

Then inspect:

```text
Deployment configuration
        ↓
ReplicaSet
        ↓
Pod specification
        ↓
Container configuration
        ↓
Events
```

This follows the larger Kubernetes architecture we learned earlier:

> Kubernetes objects are connected through controllers and desired state.

---

# 33. Commands Relevant to Day 9

Inspect nodes:

```powershell
kubectl get nodes
```

Inspect detailed node resources:

```powershell
kubectl describe node <node-name>
```

Inspect ReplicaSets:

```powershell
kubectl get rs
```

Inspect Deployment rollout history:

```powershell
kubectl rollout history deployment task-api
```

Inspect a failed Pod:

```powershell
kubectl describe pod <failed-pod-name>
```

Preview Kustomize output:

```powershell
kubectl kustomize overlays/dev
```

Apply the Dev overlay:

```powershell
kubectl apply -k overlays/dev
```

---

# 34. Complete Day 9 Mental Model

```text
                    Kubernetes Resources

                         CPU / Memory
                              │
              ┌───────────────┴───────────────┐
              │                               │
           REQUEST                          LIMIT
              │                               │
              ↓                               ↓
        Scheduling                    Runtime boundary
              │                               │
              │                     ┌─────────┴─────────┐
              │                     │                   │
              │                 CPU limit          Memory limit
              │                     │                   │
              │                 throttling          OOM kill
              │
              ↓
       Scheduler decides
       whether Pod fits
       on a Node
              │
              ↓
       Node Allocatable
```

QoS:

```text
Resources configured
        │
        ↓
   QoS classification
        │
   ┌────┼──────────┐
   ↓    ↓          ↓
Guaranteed Burstable BestEffort
   │      │          │
   │      │          │
stronger middle    weaker
protection         protection
```

---

# 35. Interview-Level Answers

### What is a resource request?

A resource request tells Kubernetes how much CPU/memory a container declares as needed for scheduling/resource accounting.

### What is a resource limit?

A resource limit defines the runtime usage boundary for a container.

### Does a request prevent a container from using more?

No. A container can use more than its request if resources are available and it stays within its limit.

### What happens when CPU exceeds the limit?

CPU usage can be throttled.

### What happens when memory exceeds the limit?

The container can be OOM-killed.

### Does the Scheduler primarily use current CPU usage?

No. Resource requests are the key declared resource input used for scheduling.

### Can total limits exceed node capacity?

Yes. Kubernetes supports resource overcommitment.

### What is Capacity?

The node's total resource capacity.

### What is Allocatable?

The amount of node resources made available for Pods after accounting for node/system reservations.

### What are the QoS classes?

```text
Guaranteed
Burstable
BestEffort
```

### Which is generally least protected during severe resource pressure?

BestEffort.

### Does Guaranteed mean "never evicted"?

No. QoS gives a protection hierarchy, not an absolute guarantee.

### What is the most important resource rule?

> **A limit is not a reservation.**

---

# 36. Day 9 Final Summary

We started with the problem:

> **How does Kubernetes know whether a Pod can fit on a Worker Node?**

The answer begins with **resource requests**.

```text
Pod request
     ↓
Scheduler
     ↓
Does the Pod fit on this Node?
```

Then we introduced **limits**:

```text
Request → scheduling
Limit   → runtime boundary
```

We learned:

```text
CPU limit exceeded
    → throttling

Memory limit exceeded
    → possible OOM kill
```

We connected resource requests to:

```text
Node Capacity
       ↓
Node Allocatable
       ↓
Pod requests
       ↓
Scheduler placement
```

We learned overcommitment:

```text
Total requests <= node allocatable
```

can coexist with:

```text
Total limits > node allocatable
```

because:

> **A limit is not a reservation.**

Finally, we learned QoS:

```text
Guaranteed
    ↓
Burstable
    ↓
BestEffort
```

with the simplified protection hierarchy:

```text
Guaranteed → strongest
Burstable   → middle
BestEffort  → weakest
```

while remembering that actual eviction decisions involve additional factors.

The single most important Day 9 mental model is:

> **Requests tell Kubernetes what the workload declares it needs for scheduling. Limits define runtime boundaries. QoS describes the resulting resource-quality category and influences protection under resource pressure.**

---

# 37. Day 9 Completion Checklist

- [x] Why resource requests are needed
- [x] Resource requests
- [x] Resource limits
- [x] Requests vs limits
- [x] CPU millicores
- [x] Memory units
- [x] Requests vs actual usage
- [x] CPU usage above requests
- [x] CPU throttling
- [x] Memory limits and OOM killing
- [x] Container-level resources
- [x] Pod resources with multiple containers
- [x] Scheduler schedules whole Pods
- [x] Node Capacity
- [x] Node Allocatable
- [x] Resource overcommitment
- [x] Why limits can exceed node capacity
- [x] "A limit is not a reservation"
- [x] QoS classes
- [x] Guaranteed
- [x] Burstable
- [x] BestEffort
- [x] QoS and memory-pressure protection
- [x] QoS challenge
- [x] Eviction reasoning correction
- [x] Kustomize and resource changes
- [x] `kubectl apply` vs rollout
- [x] ReplicaSet age vs Pod age
- [x] Deployment → ReplicaSet → Pod
- [x] Failed Pod ownership investigation
- [x] `CreateContainerConfigError` investigation approach
- [x] Day 9 debugging commands

