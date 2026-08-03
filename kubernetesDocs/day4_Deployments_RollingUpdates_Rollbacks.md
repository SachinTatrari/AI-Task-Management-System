# Kubernetes - Day 4
# Deployments, Rolling Updates & Rollbacks

> **Objective**
>
> Understand why ReplicaSets alone are not enough and how Deployments provide zero-downtime deployments, version management, rolling updates, and rollbacks.
>
> By the end of this session, we should be able to answer:
>
> **"If ReplicaSets already provide scaling and self-healing, why does Kubernetes need Deployments?"**

---

# Revision from Day 3

Yesterday we learned that ReplicaSets ensure the desired number of Pods are always running.

```
ReplicaSet

↓

Desired = Current

↓

Application Healthy
```

If a Pod disappears:

```
Desired = 3

Current = 2

↓

ReplicaSet creates a new Pod
```

If replicas increase:

```
replicas: 1

↓

replicas: 3

↓

ReplicaSet creates two new Pods
```

If replicas decrease:

```
replicas: 3

↓

replicas: 1

↓

ReplicaSet deletes two Pods
```

ReplicaSets provide:

- Scaling
- Self-Healing
- Desired State Reconciliation

At first glance they seem sufficient.

But they have one major limitation.

---

# The Problem

Suppose your application is running:

```
task-api:v1
```

Cluster:

```
ReplicaSet(v1)

↓

Pod A

Pod B

Pod C
```

Everything is healthy.

Now your developers release:

```
task-api:v2
```

Question:

How do we safely replace Version 1 with Version 2?

---

# Why ReplicaSets Are Not Enough

A ReplicaSet only understands one thing.

> Maintain the desired number of Pods.

It does **not** understand:

- Application versions
- Deployments
- Upgrades
- Rollbacks
- Version history

If we directly modify the ReplicaSet:

```
image: v1

↓

image: v2
```

Several problems appear.

---

# Problem 1 - Downtime

Suppose we manually delete all Pods.

```
Delete Pod A

Delete Pod B

Delete Pod C
```

For a short period:

```
Running Pods = 0
```

Users cannot access the application.

This is unacceptable for production systems.

---

# Problem 2 - No Rollback

Suppose all Pods become Version 2.

Five minutes later customers report serious bugs.

Unfortunately:

Version 1 no longer exists.

There is nothing to return to.

This is even more dangerous than downtime.

---

# Kubernetes Solution

Instead of modifying ReplicaSets,

Kubernetes introduces a higher-level object:

```
Deployment

↓

ReplicaSet

↓

Pods
```

Notice something important.

Deployment does **not** replace ReplicaSets.

It **manages** ReplicaSets.

ReplicaSets continue performing exactly the same job:

> Maintain the desired number of Pods.

Deployment receives new responsibilities.

---

# Responsibilities of a Deployment

A Deployment manages:

- Application versions
- Rolling Updates
- Rollbacks
- Deployment History
- ReplicaSets

A Deployment does **not** create containers.

A Deployment does **not** schedule Pods.

A Deployment simply manages application releases.

---

# Deployment Hierarchy

Instead of:

```
ReplicaSet

↓

Pods
```

The architecture becomes:

```
Deployment

↓

ReplicaSet

↓

Pods
```

Every component still has exactly one responsibility.

---

# Deploying a New Version

Current deployment:

```
task-api:v1
```

Application:

```
Deployment

↓

ReplicaSet(v1)

↓

3 Pods
```

Developers release:

```
task-api:v2
```

Question:

Does Deployment modify ReplicaSet(v1)?

No.

Deployment creates an entirely **new ReplicaSet**.

```
Deployment

├──────────────┐

▼              ▼

ReplicaSet(v1) ReplicaSet(v2)
```

Initially:

ReplicaSet(v1)

```
3 Pods
```

ReplicaSet(v2)

```
0 Pods
```

Nothing has been destroyed.

---

# Why Create a New ReplicaSet?

This follows the same Kubernetes philosophy we have seen throughout the course.

Pods:

```
Don't repair them.

Create new ones.
```

ReplicaSets:

```
Don't modify them.

Create a new ReplicaSet.
```

Deployment preserves the old ReplicaSet for future rollback.

---

# Rolling Updates

Instead of replacing all Pods simultaneously,

Deployment gradually transitions from Version 1 to Version 2.

Initial state:

```
ReplicaSet(v1)

3 Pods
```

ReplicaSet(v2)

```
0 Pods
```

Step 1

Deployment creates one new Pod.

```
ReplicaSet(v1)

3 Pods
```

```
ReplicaSet(v2)

1 Pod
```

Total:

```
4 Pods
```

Notice:

Users continue accessing the application.

There is no downtime.

---

# Health Verification

Deployment does **not** immediately delete an old Pod.

Instead it waits.

Question:

Did the new Pod become healthy?

If:

YES

Proceed.

If:

NO

Stop the rollout.

This prevents broken versions from replacing healthy applications.

---

# Continuing the Rollout

After the first Pod becomes healthy:

```
ReplicaSet(v1)

2 Pods
```

```
ReplicaSet(v2)

1 Pod
```

Deployment repeats the process.

```
+1 New Pod

↓

-1 Old Pod
```

Eventually:

```
ReplicaSet(v1)

0 Pods
```

```
ReplicaSet(v2)

3 Pods
```

The rollout finishes without downtime.

---

# Rolling Update Summary

Instead of:

```
Delete 3 Pods

↓

Create 3 Pods
```

Deployment performs:

```
+1 New Pod

↓

Health Check

↓

-1 Old Pod

↓

Repeat
```

This strategy is called a **Rolling Update**.

---

# Failed Deployment

Suppose:

The first Version 2 Pod starts.

Instead of becoming healthy:

```
CrashLoopBackOff
```

or

```
ImagePullBackOff
```

Deployment immediately stops.

Current situation:

```
ReplicaSet(v1)

3 Healthy Pods
```

```
ReplicaSet(v2)

1 Failed Pod
```

Deployment does **not** continue deleting old Pods.

The healthy application remains available.

---

# Rollbacks

Suppose Version 2 contains a serious bug.

Deployment still has:

```
ReplicaSet(v1)

↓

Stored
```

Rollback becomes very simple.

```
ReplicaSet(v2)

↓

Scale to 0
```

```
ReplicaSet(v1)

↓

Scale back to 3
```

Application immediately returns to the previous stable version.

No rebuilding.

No redeployment.

No image recreation.

---

# Why Old ReplicaSets Are Kept

Even after Version 2 is successfully deployed:

```
ReplicaSet(v1)

0 Pods
```

Kubernetes normally keeps the old ReplicaSet.

Reason:

Future rollbacks.

Deployment history.

Version tracking.

Old ReplicaSets consume almost no resources because they manage zero Pods.

---

# Deployment Version History

Suppose three versions have been deployed.

```
Deployment

│

├── ReplicaSet(v1)

│      0 Pods

│

├── ReplicaSet(v2)

│      0 Pods

│

└── ReplicaSet(v3)

       3 Pods
```

Deployment behaves similarly to Git.

Instead of Git commits,

Deployment stores ReplicaSets.

Rollback simply activates a previous ReplicaSet.

---

# Git Analogy

Git:

```
Commit 1

↓

Commit 2

↓

Commit 3
```

Rollback:

```
Checkout Commit 2
```

Deployment:

```
ReplicaSet(v1)

↓

ReplicaSet(v2)

↓

ReplicaSet(v3)
```

Rollback:

```
Scale ReplicaSet(v2)

↓

Deactivate ReplicaSet(v3)
```

---

# Complete Deployment Flow

Developer updates:

```
deployment.yaml

↓

image: task-api:v2
```

Deployment notices:

```
Image Changed
```

↓

Creates:

```
New ReplicaSet
```

↓

ReplicaSet creates:

```
Pending Pod
```

↓

Scheduler:

```
Assign Worker Node
```

↓

kubelet:

```
Receives Assignment
```

↓

containerd:

```
Pull Image

↓

Create Container

↓

Run Container
```

↓

Deployment waits for Pod health.

↓

If healthy:

Old ReplicaSet scales down.

Repeat until rollout completes.

---

# Responsibilities Summary

| Component | Responsibility |
|-----------|----------------|
| Deployment | Manage application versions, rolling updates and rollbacks |
| ReplicaSet | Maintain desired number of Pod replicas |
| Scheduler | Assign Pods to Worker Nodes |
| kubelet | Run assigned Pods on Worker Nodes |
| containerd | Pull images and create containers |
| API Server | Central communication hub for all components |

---

# Common Misconceptions

❌ Deployment creates Pods directly.

✅ Deployment creates ReplicaSets.

ReplicaSets create Pods.

---

❌ Deployment replaces ReplicaSets.

✅ Deployment manages ReplicaSets.

---

❌ Deployment updates existing ReplicaSets.

✅ Deployment creates entirely new ReplicaSets.

---

❌ Kubernetes deletes previous versions immediately.

✅ Previous ReplicaSets are retained for rollback.

---

❌ ReplicaSet understands application upgrades.

✅ ReplicaSet only manages Pod count.

Deployment manages application upgrades.

---

# Interview Questions

## Why do we need Deployments if ReplicaSets already exist?

ReplicaSets maintain the desired number of Pod replicas.

Deployments manage application releases by creating and managing ReplicaSets, enabling rolling updates, version history and rollbacks.

---

## Does a Deployment create Pods?

No.

Deployment creates ReplicaSets.

ReplicaSets create Pods.

---

## Why does Kubernetes create a new ReplicaSet during upgrades?

To preserve the previous version for safe rollback while gradually introducing the new version.

---

## What is a Rolling Update?

A deployment strategy where new Pods are created gradually while old Pods are removed only after the new Pods become healthy.

This ensures zero downtime.

---

## What happens if a new Pod fails during a Rolling Update?

Deployment pauses the rollout.

The old ReplicaSet continues serving traffic.

Healthy Pods are never replaced by broken Pods.

---

## Why are old ReplicaSets kept?

To maintain deployment history and allow quick rollbacks to previous stable versions.

---

# Today's Learning Summary

Today we learned how Kubernetes safely upgrades applications.

```
Developer Updates deployment.yaml

↓

Deployment

↓

Creates New ReplicaSet

↓

ReplicaSet creates New Pods

↓

Scheduler assigns Worker Nodes

↓

kubelet

↓

containerd

↓

New Pod Running

↓

Deployment verifies Pod health

↓

Old ReplicaSet scales down

↓

Repeat

↓

Deployment Complete
```

The most important lesson from today is:

> **ReplicaSets manage Pod replicas. Deployments manage ReplicaSets. This separation of responsibilities allows Kubernetes to perform safe rolling updates, preserve deployment history, and support instant rollbacks without downtime.**