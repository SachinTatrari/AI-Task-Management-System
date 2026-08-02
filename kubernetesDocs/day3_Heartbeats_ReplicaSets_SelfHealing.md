# Kubernetes - Day 3
# Heartbeats, ReplicaSets & Self-Healing

> **Objective**
>
> Understand how Kubernetes detects Worker Node failures and automatically restores the desired number of Pods.
>
> By the end of this session, we should be able to answer:
>
> **"If a Pod or an entire Worker Node dies, how does Kubernetes detect it and recover automatically?"**

---

# Revision from Day 2

At the end of Day 2, we understood how a Pod reaches the Running state.

```
Scheduler

↓

Assign Pod

↓

API Server

↓

kubelet

↓

containerd

↓

Running Pod
```

Everything is working perfectly.

But now imagine something unexpected happens.

A Worker Node suddenly crashes.

How does Kubernetes even know?

This is where today's journey begins.

---

# Heartbeats

Every Worker Node runs a kubelet.

Besides creating and monitoring Pods, the kubelet has another important responsibility.

It periodically tells the Control Plane:

> **"I'm alive."**

These periodic health messages are called **Heartbeats**.

```
Worker Node

↓

kubelet

↓

Heartbeat

↓

API Server
```

As long as the API Server keeps receiving heartbeats, Kubernetes assumes the Worker Node is healthy.

---

# Who Sends the Heartbeats?

The **kubelet** sends them.

Not:

- Pods
- Scheduler
- containerd
- Node Controller

Only the kubelet reports the health of its Worker Node.

---

# Who Checks the Heartbeats?

The **Node Controller** continuously monitors the latest heartbeat information stored in the API Server.

Example:

```
12:00:05

Heartbeat Received
```

```
12:00:15

Heartbeat Received
```

```
12:00:25

Heartbeat Received
```

Everything is healthy.

---

# Worker Node Failure

Suppose the power cable is unplugged.

```
Worker Node

OFF
```

Immediately:

- kubelet stops
- Pods stop
- containerd stops

Most importantly:

Heartbeats stop.

```
12:00:35

No Heartbeat
```

```
12:00:45

No Heartbeat
```

```
12:00:55

No Heartbeat
```

The Node Controller concludes:

> "I can no longer trust this Worker Node."

The Worker Node is marked:

```
NotReady
```

---

# Important Concept

The Node Controller does **not** know why heartbeats stopped.

Possible reasons:

- Worker Node crashed
- kubelet crashed
- Network failure
- Machine rebooting

From the Control Plane's perspective, all these situations appear identical.

The only observable fact is:

> **Heartbeats have stopped.**

---

# Why Doesn't Kubernetes React Immediately?

Imagine the kubelet temporarily restarts.

If Kubernetes instantly created replacement Pods, the original Worker Node might recover a few seconds later.

Result:

```
Old Pod

+

New Pod
```

Now two copies of the same application exist.

For some workloads (payments, jobs, transactions), this could be disastrous.

Therefore Kubernetes waits for a **Grace Period** before declaring a Worker Node unhealthy.

---

# Grace Period

The sequence becomes:

```
Heartbeat Stops

↓

Wait

↓

Still No Heartbeat

↓

Node marked NotReady

↓

Recovery begins
```

This prevents unnecessary Pod duplication caused by temporary failures.

---

# Recovery After Node Failure

Once the Worker Node is considered unavailable:

The Node Controller reports the Node as unhealthy.

Now another controller notices something.

The application no longer has enough Pods.

Example:

Desired:

```
Task API

Replicas = 3
```

Current:

```
Pod A

Pod C
```

Current replicas:

```
2
```

Desired replicas:

```
3
```

A mismatch exists.

This introduces the **ReplicaSet Controller**.

---

# What is a ReplicaSet?

A ReplicaSet has exactly one responsibility.

> **Maintain a specified number of identical Pods.**

Nothing more.

Nothing less.

If you ask for:

```yaml
replicas: 3
```

The ReplicaSet continuously ensures exactly three Pods exist.

---

# Desired State vs Current State

Desired:

```
3 Pods
```

Current:

```
2 Pods
```

ReplicaSet immediately begins reconciliation.

```
Desired

↓

Current

↓

Mismatch

↓

Create New Pod
```

---

# ReplicaSet Does NOT Repair Pods

Suppose:

```
Pod B
```

crashes.

Does Kubernetes repair Pod B?

No.

Instead:

```
Pod B

↓

Deleted

↓

ReplicaSet

↓

Creates Pod D
```

The replacement Pod has:

- Different Pod name
- Different IP Address
- Different Container ID

This is perfectly normal.

Pods are **Ephemeral**.

---

# Ephemeral Pods

Pods are temporary.

They are designed to be:

- Created
- Destroyed
- Recreated

Instead of repairing a damaged Pod, Kubernetes simply creates another one.

Think of Pods as disposable objects rather than permanent machines.

---

# ReplicaSet and the Scheduler

Suppose Pod B disappears.

ReplicaSet notices:

```
Desired = 3

Current = 2
```

ReplicaSet creates a **new Pending Pod** through the API Server.

```
ReplicaSet Controller

↓

API Server

↓

Pending Pod
```

Now the Scheduler notices:

```
Pending Pod

↓

No Worker Node Assigned
```

The Scheduler selects the best Worker Node.

```
Scheduler

↓

Worker Node 3
```

The kubelet receives the assignment.

```
kubelet

↓

containerd

↓

Running Pod
```

Notice something important.

The ReplicaSet **does not** decide where Pods run.

That responsibility belongs exclusively to the Scheduler.

---

# Scaling Up

Initially:

```yaml
replicas: 1
```

Cluster:

```
Pod A
```

Suppose traffic suddenly increases.

We update:

```yaml
replicas: 3
```

ReplicaSet observes:

```
Desired = 3

Current = 1
```

It creates:

```
Pod B

Pod C
```

Both become Pending.

The Scheduler assigns them to Worker Nodes.

Eventually:

```
Desired = 3

Current = 3
```

Scaling complete.

---

# Scaling Down

Suppose traffic decreases.

We update:

```yaml
replicas: 1
```

Current:

```
Pod A

Pod B

Pod C
```

Desired:

```
Pod Count = 1
```

ReplicaSet notices:

```
Desired = 1

Current = 3
```

It requests deletion of two Pods through the API Server.

Eventually:

```
One Pod Remaining
```

Again, Kubernetes does not care **which Pod survives**.

It only cares that:

```
Desired = Current
```

---

# Responsibilities Summary

| Component | Responsibility |
|-----------|----------------|
| kubelet | Send heartbeats and manage Pods on its Worker Node |
| API Server | Receive and expose heartbeat information |
| Node Controller | Monitor heartbeats and detect unhealthy Worker Nodes |
| ReplicaSet Controller | Maintain the desired number of Pod replicas |
| Scheduler | Assign Pending Pods to Worker Nodes |
| containerd | Create and run containers |

---

# Common Misconceptions

❌ The Node Controller knows whether Linux is healthy.

✅ The Node Controller only knows whether heartbeats are arriving.

---

❌ ReplicaSet restarts failed Pods.

✅ ReplicaSet creates entirely new Pods.

---

❌ ReplicaSet chooses Worker Nodes.

✅ The Scheduler chooses Worker Nodes.

---

❌ Pods are permanent.

✅ Pods are ephemeral and disposable.

---

# Interview Questions

## What is the purpose of Heartbeats?

Heartbeats allow the kubelet to periodically report that its Worker Node is healthy.

The Node Controller uses these heartbeats to detect Worker Node failures.

---

## What happens if heartbeats stop?

The Node Controller waits for a grace period.

If heartbeats still do not resume, the Worker Node is marked **NotReady**.

---

## What is a ReplicaSet?

A ReplicaSet continuously reconciles the desired number of Pod replicas with the current number of running Pods by creating or removing Pods whenever necessary.

---

## Does ReplicaSet restart failed Pods?

No.

ReplicaSet creates entirely new Pods instead of repairing failed ones.

---

## Who decides where the replacement Pod runs?

The ReplicaSet creates the Pending Pod.

The Scheduler selects the Worker Node.

The kubelet starts the Pod on that Worker Node.

---

# Today's Learning Summary

Today we understood how Kubernetes achieves **Self-Healing**.

```
Worker Node Failure

↓

Heartbeats Stop

↓

Node Controller

↓

Node Marked NotReady

↓

ReplicaSet

↓

Desired > Current

↓

New Pending Pod

↓

Scheduler

↓

kubelet

↓

containerd

↓

Running Pod
```

This entire process happens automatically without manual intervention.

The biggest lesson from today is:

> **Kubernetes does not repair failed Pods. It continuously restores the desired state by creating or removing Pods until the cluster matches the declared configuration.**