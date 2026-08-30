# DevOps Mastered --- Kubernetes Day 8

## Kustomize: Base, Dev/Prod Overlays, ConfigMaps & Secrets

> **Theme:** One common Kubernetes application definition, customized
> safely for different environments without duplicating manifests.

------------------------------------------------------------------------

## 1. Why Kustomize?

We moved away from maintaining separate complete manifests such as:

-   `deployment-dev.yaml`
-   `deployment-prod.yaml`
-   `configmap-dev.yaml`
-   `configmap-prod.yaml`

because duplication creates:

-   inconsistency
-   double maintenance
-   configuration drift
-   the risk of fixing Dev but forgetting Prod
-   harder debugging

Our principle:

> **Keep common configuration in the base. Put only environment-specific
> differences in overlays.**

------------------------------------------------------------------------

## 2. Our Kustomize Structure

``` text
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

`.env.secret` is local input and is ignored by Git.

------------------------------------------------------------------------

## 3. Base vs Overlay

The base contains resources common to the application:

-   Task API Deployment
-   Task API Service
-   ConfigMap
-   MongoDB Deployment
-   MongoDB Service
-   MongoDB PVC

The rule is:

> **Decide base vs overlay based on whether the configuration is common
> or environment-specific, not based on the resource type.**

Mental model:

``` text
                    BASE
                     │
             common application
                     │
          ┌──────────┴──────────┐
          │                     │
         DEV                   PROD
          │                     │
      differences           differences
```

------------------------------------------------------------------------

## 4. Replica Customization

Base:

``` yaml
replicas: 3
```

Dev overlay:

``` yaml
replicas:
  - name: task-api
    count: 1
```

Prod has no replica override.

Therefore:

``` text
BASE → 3
DEV  → 1
PROD → 3 (inherited)
```

This demonstrated that an overlay does not need to redefine everything.

------------------------------------------------------------------------

## 5. `-f` vs `-k`

### `-f`

``` powershell
kubectl apply -f deployment.yaml
```

Applies a YAML manifest directly.

### `-k`

``` powershell
kubectl apply -k overlays/dev
```

Builds the Kustomization and applies the resulting manifests.

Conceptually:

``` text
overlays/dev/kustomization.yaml
        ↓
base + Dev customization
        ↓
Kustomize builds final manifests
        ↓
kubectl applies them
```

------------------------------------------------------------------------

## 6. `kubectl kustomize` vs `kubectl apply -k`

Preview/build only:

``` powershell
kubectl kustomize overlays/dev
```

This builds and prints the final manifests without changing the cluster.

Build + apply:

``` powershell
kubectl apply -k overlays/dev
```

Our safe workflow became:

``` text
1. kubectl kustomize overlays/dev
          ↓
   inspect final output
          ↓
2. kubectl apply -k overlays/dev
          ↓
      change cluster
```

------------------------------------------------------------------------

## 7. Discovering the Missing Secret Manifest

The cluster contained:

``` text
task-api-secret
```

but our local repository did not contain a `secret.yaml`.

`kubectl describe secret task-api-secret` showed:

``` text
Annotations: <none>
```

So the Secret was most likely created imperatively rather than from a
saved manifest.

This exposed a real configuration-management problem:

``` text
Local/Git
    └── no Secret manifest

Cluster
    └── Secret exists
```

If the cluster were recreated from the repository, this Secret would not
automatically return.

------------------------------------------------------------------------

## 8. Secret Management with Kustomize

We did not put the real credential directly into Git.

Instead, Dev uses:

``` text
overlays/dev/.env.secret
```

containing the local Secret value.

Kustomize configuration:

``` yaml
secretGenerator:
  - name: task-api-secret
    envs:
      - .env.secret
```

The secret-value files are ignored by Git:

``` text
k8s/overlays/*/.env.secret
```

So:

``` text
.env.secret
    ├── exists locally
    ├── used by Kustomize
    └── ignored by Git
```

For a real production environment, an external secret-management
solution would normally be preferable.

------------------------------------------------------------------------

## 9. Kustomize Secret Hashing

Kustomize generated a hashed Secret name such as:

``` text
task-api-secret-ff54d8tt5k
```

and automatically rewrote the Deployment reference:

``` yaml
secretKeyRef:
  key: MONGO_URI
  name: task-api-secret-ff54d8tt5k
```

The hash is derived from the generated Secret content.

Therefore:

``` text
Secret content
      ↓
    hash
      ↓
task-api-secret-<hash>
```

If the content changes, the generated name can change.

------------------------------------------------------------------------

## 10. Secret Change → Deployment Rollout

Changing `.env.secret` alone does not change Kubernetes.

The full chain is:

``` text
Edit .env.secret
       ↓
nothing changes in cluster yet
       ↓
kubectl apply -k overlays/dev
       ↓
Kustomize reads new value
       ↓
new Secret hash/name
       ↓
Deployment secretKeyRef changes
       ↓
Pod template changes
       ↓
Deployment creates a new ReplicaSet
       ↓
new Pods roll out
```

Important distinction:

> **The Secret does not directly restart the Pods. The changed Secret
> reference changes the Pod template, which causes the Deployment
> rollout.**

------------------------------------------------------------------------

## 11. Real Debugging: One Space Broke MongoDB

Initially:

``` text
MONGO_URI= mongodb://mongo:27017/taskdb
```

There was a space after `=`.

MongoDB failed with an invalid scheme error.

We changed it to:

``` text
MONGO_URI=mongodb://mongo:27017/taskdb
```

and the database connected successfully.

This taught a valuable debugging lesson:

> **Kubernetes resources can all be correct while one character in
> configuration causes the application to fail.**

------------------------------------------------------------------------

## 12. Observing the Secret Hash Change

Before the fix:

``` text
task-api-secret-ff54d8tt5k
```

After removing the space:

``` text
task-api-secret-d6bfmg8c8
```

The Deployment then referenced the new Secret.

The complete chain was:

``` text
Secret value changed
       ↓
hash changed
       ↓
Secret name changed
       ↓
Deployment reference changed
       ↓
Pod template changed
       ↓
rollout
```

------------------------------------------------------------------------

## 13. What If the Referenced Secret Is Deleted?

When a Secret is consumed as an environment variable, the running
container already has the value it received at startup.

Therefore:

``` text
Secret deleted
      │
      ├── Existing Pod
      │      └── already has env value → can continue running
      │
      └── New/restarted Pod
             └── needs Secret → can fail to start
```

So deleting the Secret is dangerous even if the currently running Pod
appears healthy.

------------------------------------------------------------------------

## 14. ConfigMap Patching

Base ConfigMap:

``` yaml
data:
  NODE_ENV: development
  LOG_LEVEL: info
  PORT: "3000"
```

Dev patches only:

``` text
LOG_LEVEL → debug
```

using:

``` yaml
patches:
  - target:
      kind: ConfigMap
      name: task-api-config
    patch: |-
      - op: replace
        path: /data/LOG_LEVEL
        value: debug
```

Final Dev configuration:

``` text
NODE_ENV = development  ← inherited
LOG_LEVEL = debug       ← overridden
PORT = 3000             ← inherited
```

The base remains unchanged.

------------------------------------------------------------------------

## 15. Dev and Prod Overlays

### Dev

``` text
NODE_ENV = development
LOG_LEVEL = debug
PORT = 3000
replicas = 1
```

### Prod

``` text
NODE_ENV = production
LOG_LEVEL = info
PORT = 3000
replicas = 3
```

The environments differ only where they need to differ.

------------------------------------------------------------------------

## 16. Important Discovery: Dev and Prod Got the Same Secret Name

We noticed both overlays produced:

``` text
task-api-secret-d6bfmg8c8
```

This was not a Kustomize bug.

Both overlays currently use the same Secret content:

``` text
MONGO_URI=mongodb://mongo:27017/taskdb
```

Therefore:

``` text
DEV
same content
    ↓
same hash
    ↓
task-api-secret-d6bfmg8c8

PROD
same content
    ↓
same hash
    ↓
task-api-secret-d6bfmg8c8
```

Key lesson:

> **Same Secret content → same hash → same generated Secret name.**

For true environment isolation, Dev and Prod should normally use
different database endpoints/credentials and often separate namespaces
or clusters.

Our current Kind learning cluster has one MongoDB instance, so we
deliberately stopped here rather than building a second MongoDB
environment just to force different hashes.

------------------------------------------------------------------------

## 17. Debugging Principle

We reinforced:

> **Debug at the layer where the incorrect state is introduced.**

If:

``` powershell
kubectl kustomize overlays/dev
```

produces incorrect YAML, debug:

``` text
base
overlay
patches
generators
```

If the generated YAML is correct but the running resource is wrong,
debug Kubernetes.

If Kubernetes is correct but the application fails, debug the
application/configuration.

------------------------------------------------------------------------

# Day 8 Challenge Results

## Challenge 1

Base = 3 replicas, Dev = 1, Prod has no override.

**Answer: B --- Dev = 1, Prod = 3.**

## Challenge 2

Dev changes only `LOG_LEVEL`.

**Answer: B --- the other ConfigMap values are inherited.**

## Challenge 3

A common bug is fixed in the base.

**Answer: C --- both environments inherit the fix unless an overlay
overrides it.**

## Challenge 4

Secret change chain:

``` text
Secret changes
→ new Kustomize hash/name
→ Deployment reference changes
→ Pod template changes
→ new ReplicaSet
→ Pod rollout
```

## Challenge 5

Separate complete Dev/Prod manifests or overlays?

**Overlays.**

Reasons:

-   Avoid duplication
-   Maintain consistency
-   Reduce configuration drift
-   Easier debugging
-   Common fixes stay centralized

## Challenge 6

Dev unexpectedly receives `NODE_ENV: production`.

**Answer: B --- inspect the base ConfigMap and Dev overlay patches
first.**

### Result

**6/6 --- strong understanding.**

------------------------------------------------------------------------

# Key Commands Learned

### Preview Kustomize

``` powershell
kubectl kustomize overlays/dev
kubectl kustomize overlays/prod
```

### Apply Kustomize

``` powershell
kubectl apply -k overlays/dev
```

### Inspect Secrets

``` powershell
kubectl get secret
kubectl describe secret <secret-name>
```

### Inspect Deployment Secret reference

``` powershell
kubectl get deployment task-api -o yaml | Select-String "secretKeyRef" -Context 2,4
```

### Inspect Pods

``` powershell
kubectl get pods
```

### Inspect application logs

``` powershell
kubectl logs deployment/task-api
```

### Inspect ignored Git files

``` powershell
git status --ignored
```

------------------------------------------------------------------------

# Interview-Level Takeaways

### What is Kustomize?

> Kustomize is a Kubernetes-native configuration customization tool that
> allows us to maintain a common base and create environment-specific
> overlays without duplicating manifests.

### Why use overlays?

> To isolate environment-specific changes while maintaining a single
> source of truth for common configuration.

### What does `kubectl apply -k` do?

> It builds the manifests using the Kustomization configuration and
> applies the resulting resources.

### What does `kubectl kustomize` do?

> It builds and prints the final Kustomized manifests without applying
> them.

### Why does Kustomize add a hash to generated Secrets?

> The generated name incorporates a content hash, so changed Secret
> content produces a different generated name. A changed Secret
> reference changes the Deployment Pod template and can trigger a
> rollout.

### Does changing a Secret automatically restart Pods?

> Not by itself. In our Kustomize setup, the changed Secret content
> produces a new hashed name, the Deployment reference changes, the Pod
> template changes, and the Deployment rolls out new Pods.

### What happens if a referenced Secret is deleted?

> Existing containers using the value as an environment variable may
> continue running, but replacement/restarted Pods that need the missing
> Secret can fail to start.

------------------------------------------------------------------------

# Final Day 8 Mental Model

``` text
                         KUBERNETES
                              │
                          KUSTOMIZE
                              │
                             BASE
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
   Task API                MongoDB               Storage
   Deployment              Deployment               PVC
   Service                 Service
   ConfigMap
                              │
                    ┌─────────┴─────────┐
                    │                   │
                   DEV                 PROD
                    │                   │
              replicas: 1          replicas: 3
              debug config         production config
              Dev secret           Prod secret
                    │                   │
                    └─────────┬─────────┘
                              │
                    common configuration
                       inherited from base
```

------------------------------------------------------------------------

# Day 8 Core Principle

> **Keep common things in the base. Customize only what actually differs
> in the overlay.**

One source of truth + minimal environment-specific changes gives us:

-   less duplication
-   less configuration drift
-   easier debugging
-   safer environment management
-   easier rollout of common fixes

## Day 8 Status

**Completed:**

-   Kustomize Base/Overlay architecture
-   Dev overlay
-   Prod overlay
-   Replica customization
-   ConfigMap patching
-   Secret generation
-   Secret hashing
-   Deployment reference rewriting
-   Secret-driven rollout behavior
-   `kubectl -f` vs `kubectl -k`
-   `kubectl kustomize` vs `kubectl apply -k`
-   Secret debugging
-   Git protection for local Secret values
-   Dev/Prod configuration reasoning
-   6/6 challenge

**Intentionally left for later:**

-   True Dev/Prod database isolation
-   Separate namespaces or clusters
-   Production-grade external Secret management
