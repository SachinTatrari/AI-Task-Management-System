# Day 6 — Kubernetes Configuration Management

## Goal

Day 6 focused on ConfigMaps, Secrets, environment-variable injection, configuration updates, rollout behavior, immutable application images, and environment-specific configuration.

## 1. Configuration Outside the Image

Our image:

```text
ai-task-management-system-app:latest
```

contains the application, while values such as:

```text
PORT
NODE_ENV
LOG_LEVEL
MONGO_URI
```

are supplied externally.

The principle:

```text
Image = application artifact
Configuration = environment-specific behavior
```

This lets the same image be used in development, testing and production.

---

## 2. ConfigMap

Our ConfigMap became:

```yaml
apiVersion: v1
kind: ConfigMap

data:
  LOG_LEVEL: info
  NODE_ENV: development
  PORT: "3000"
```

We verified it with:

```bash
kubectl get configmap task-api-config -o yaml
```

---

## 3. `env` vs `envFrom`

### Selective injection

```yaml
env:
  - name: PORT
    valueFrom:
      configMapKeyRef:
        name: task-api-config
        key: PORT
```

This imports one specific key.

### Bulk injection

```yaml
envFrom:
  - configMapRef:
      name: task-api-config
```

This imports all ConfigMap keys as environment variables.

For our ConfigMap:

```text
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

The mental model:

```text
env + configMapKeyRef
    -> selective

envFrom + configMapRef
    -> bulk
```

---

## 4. ConfigMap + Secret Together

We used:

```yaml
envFrom:
  - configMapRef:
      name: task-api-config

env:
  - name: MONGO_URI
    valueFrom:
      secretKeyRef:
        name: task-api-secret
        key: MONGO_URI
```

So:

```text
ConfigMap
  -> PORT
  -> NODE_ENV
  -> LOG_LEVEL

Secret
  -> MONGO_URI
```

Important: `envFrom` removes the need for individual ConfigMap references in the Deployment, but the keys remain in the ConfigMap itself.

---

## 5. ConfigMap as a Volume — Conceptual Only

We discussed that a ConfigMap can also be mounted as files.

Conceptually:

```text
ConfigMap
   |
   v
mounted volume
   |
   v
/etc/config/
   ├── PORT
   ├── NODE_ENV
   └── LOG_LEVEL
```

Kubernetes does not modify the Docker image. The container runtime mounts the volume according to the Pod specification.

We did not implement this for the Task API because our Node.js application naturally consumes:

```javascript
process.env.PORT
process.env.NODE_ENV
process.env.MONGO_URI
```

---

## 6. Updating a ConfigMap

We changed:

```text
LOG_LEVEL=info
```

to:

```text
LOG_LEVEL=debug
```

and applied only the ConfigMap:

```bash
kubectl apply -f configmap.yaml
```

The existing Task API Pod still returned:

```text
info
```

when checking:

```bash
kubectl exec deploy/task-api -- printenv LOG_LEVEL
```

Why?

Environment variables are established when the container is created. Changing the ConfigMap object does not automatically recreate the container.

---

## 7. Applying New Configuration

We used:

```bash
kubectl rollout restart deployment/task-api
```

New Pods then received the updated value.

Mental model:

```text
ConfigMap changes
      |
      v
existing Pod -> old env

rollout
      |
      v
new Pods -> new env
```

The same principle applies to a Secret injected as an environment variable.

---

## 8. Why Kubernetes Does Not Automatically Restart Pods

A ConfigMap/Secret changing does not by itself mean the workload should restart.

If every configuration-object change automatically restarted workloads, unnecessary disruption could occur.

The important principle is:

> A ConfigMap or Secret change does not automatically imply a workload restart.

The workload's Pod template is what drives Deployment rollouts.

---

## 9. Pod Template Changes and Rollouts

We changed:

```yaml
template:
  metadata:
    annotations:
      config-version: "1"
```

to:

```yaml
template:
  metadata:
    annotations:
      config-version: "2"
```

After applying the Deployment, Kubernetes rolled out new Pods.

The chain is:

```text
kubectl apply
      |
      v
API Server
      |
      v
Deployment / Pod template changes
      |
      v
Deployment controller
      |
      v
new ReplicaSet
      |
      v
new Pods
```

Important terminology:

```text
deployment.yaml
    = manifest/configuration

Deployment controller
    = Kubernetes control logic
```

The manifest itself does not detect or perform the rollout.

---

## 10. Self-Healing vs Rollout

### Self-healing

Deleting one Pod:

```text
3 Pods
  ↓
2 Pods
  ↓
ReplicaSet notices
  ↓
replacement Pod
```

The Pod template did not change.

### Rollout

Changing the Pod template:

```text
Pod template v1
  ↓
Pod template v2
  ↓
new ReplicaSet
  ↓
new Pods
  ↓
old Pods gradually removed
```

So:

```text
Pod failure
  -> maintain desired replica count

Pod template change
  -> create a new workload revision
```

---

## 11. Configuration Version / Checksum Concept

We learned the idea behind a common real-world pattern.

Kubernetes does not automatically roll a Deployment simply because a ConfigMap changed.

A representation of the configuration can instead be placed in the Pod template:

```yaml
annotations:
  config-version: "2"
```

Or real deployment tooling may use a generated checksum:

```text
ConfigMap
   ↓
checksum
   ↓
Pod annotation
   ↓
Pod template changes when config changes
   ↓
Deployment rollout
```

We intentionally did not implement Helm checksum templating on Day 6. The goal was to understand the Kubernetes mechanism first.

---

## 12. One Image Across Environments

We discussed:

```text
DEV
TEST
PROD
```

using the same application artifact:

```text
ai-task-management-system:v1.4
```

instead of separate application images.

Conceptually:

```text
                 ONE IMAGE
                     |
       +-------------+-------------+
       |             |             |
      DEV           TEST          PROD
       |             |             |
   ConfigMap      ConfigMap     ConfigMap
   Secret         Secret        Secret
```

Advantages include:

- avoiding environment drift
- avoiding separate application artifacts
- preventing a bug from being fixed in one image while another environment still runs an older image
- promoting the same tested artifact through environments

The main issue is not merely image storage size. The bigger architectural concern is creating multiple application artifacts when we want one artifact promoted across environments.

---

## 13. Base vs Environment-Specific Configuration

The common architecture can be thought of as the base:

```text
BASE
├── Task API Deployment
├── Task API Service
├── MongoDB Deployment
└── MongoDB Service
```

Environment-specific configuration varies:

```text
DEV
├── NODE_ENV=development
├── LOG_LEVEL=debug
└── DEV MONGO_URI

PROD
├── NODE_ENV=production
├── LOG_LEVEL=warn
└── PROD MONGO_URI
```

Important distinction:

> MongoDB can be part of the common architecture while its connection configuration remains environment-specific.

For our learning project, MongoDB remains part of the base architecture, while `MONGO_URI` is environment-specific.

Because a real Mongo URI may contain credentials, it belongs in a Secret rather than a ConfigMap.

---

## 14. Why Not Duplicate Deployment Files?

Avoid:

```text
dev-deployment.yaml
test-deployment.yaml
prod-deployment.yaml
```

when most of the content is identical.

Duplicating manifests can create drift:

```text
DEV -> bug fixed
PROD -> old configuration
```

Instead:

```text
BASE
  |
  +--> DEV differences
  +--> TEST differences
  +--> PROD differences
```

The principle is:

> Put common configuration in the base; put genuine environment-specific differences in the environment-specific configuration.

This is essentially DRY applied to Kubernetes manifests.

---

## 15. Base Does Not Mean "Never Change"

Base means:

> common starting point shared by environments.

It does not mean immutable forever.

For example:

```text
BASE
replicas: 3
```

could be changed per environment:

```text
DEV  -> 1 replica
PROD -> 5 replicas
```

The common Deployment remains in the base while only intentional differences are applied by an environment.

---

## 16. Kustomize Was Deferred

We briefly reached the conceptual boundary where Kustomize would naturally fit.

However, we explicitly decided **not to implement Kustomize on Day 6**.

Kustomize should be covered at its proper place in the Kubernetes learning timeline rather than being rushed into configuration management.

Do not reorganize the current project into `base/overlays` as part of Day 6.

---

## 17. Important Commands

ConfigMap:

```bash
kubectl get configmap task-api-config -o yaml
kubectl apply -f configmap.yaml
```

Inspect injected environment:

```bash
kubectl exec deploy/task-api -- printenv PORT
kubectl exec deploy/task-api -- printenv NODE_ENV
kubectl exec deploy/task-api -- printenv LOG_LEVEL
kubectl exec deploy/task-api -- printenv MONGO_URI
```

Restart:

```bash
kubectl rollout restart deployment/task-api
```

Inspect rollout:

```bash
kubectl get pods
kubectl get replicasets
```

Apply Deployment:

```bash
kubectl apply -f deployment.yaml
```

---

# 18. Day 6 Practical Challenge — Answers

## Challenge 1

After changing:

```text
LOG_LEVEL=debug
```

to:

```text
LOG_LEVEL=info
```

and applying only the ConfigMap:

```bash
kubectl apply -f configmap.yaml
```

the existing Pod still returns:

```text
debug
```

A rollout is required:

```bash
kubectl rollout restart deployment/task-api
```

---

## Challenge 2

After changing the Secret, the existing Pod still has the old `MONGO_URI` when it was injected as an environment variable.

Reason:

> The Secret object can change, but the already-running process environment does not automatically change.

New Pods are required to receive the new value.

---

## Challenge 3

For a Pod-template change:

```text
kubectl apply
      ↓
API Server
      ↓
Deployment / Pod template changes
      ↓
Deployment controller
      ↓
new ReplicaSet
      ↓
new Pods
```

The Deployment manifest itself does not perform the rollout.

---

## Challenge 4

| Item | Classification |
|---|---|
| Task API Deployment | Base |
| Task API Service | Base |
| MongoDB Service | Base |
| `NODE_ENV=development` | Environment-specific |
| `NODE_ENV=production` | Environment-specific |
| `LOG_LEVEL=debug` in DEV | Environment-specific |
| `MONGO_URI` for DEV | Environment-specific |
| `MONGO_URI` for PROD | Environment-specific |

All classifications were correctly answered during the challenge.

---

# 19. Day 6 Debugging Playbook

When configuration isn't behaving as expected:

```text
1. Is the ConfigMap/Secret correct?
          ↓
2. Is the Deployment referencing the correct key?
          ↓
3. Is it injected as env or volume?
          ↓
4. Is the Pod old or newly created?
          ↓
5. Did the workload actually roll out?
          ↓
6. What does the application process actually see?
```

Useful checks:

```bash
kubectl get configmap task-api-config -o yaml
kubectl get secret task-api-secret
kubectl exec deploy/task-api -- printenv LOG_LEVEL
kubectl exec deploy/task-api -- printenv MONGO_URI
kubectl get pods
kubectl get replicasets
kubectl rollout status deployment/task-api
```

---

# 20. Day 6 Key Takeaways

1. **Configuration should generally be external to the image.**

```text
Image = application
Config = environment
```

2. **`env` is selective.**

```yaml
configMapKeyRef:
```

means: give me this specific key.

3. **`envFrom` is bulk injection.**

```yaml
configMapRef:
```

means: import the ConfigMap keys as environment variables.

4. **Secrets can be injected separately.**

```yaml
secretKeyRef:
```

5. **Changing a ConfigMap/Secret does not automatically update existing environment variables.**

6. **New Pods receive the new environment.**

7. **Pod-template changes trigger Deployment rollouts.**

8. **Config version/checksum patterns can connect configuration changes to Pod-template changes.**

9. **One application image should ideally be promoted across environments.**

10. **Base contains common architecture; environment-specific configuration contains intentional differences.**

11. **The Deployment manifest is not the controller.**

12. **Kustomize was intentionally deferred to its proper place in the timeline.**

---

# 21. Day 6 Completion Checklist

- [x] Understood why configuration should be outside the image
- [x] Understood immutable application artifacts
- [x] Added `LOG_LEVEL` to ConfigMap
- [x] Learned `env`
- [x] Learned `envFrom`
- [x] Compared selective vs bulk injection
- [x] Combined ConfigMap and Secret injection
- [x] Understood ConfigMap volume mounting conceptually
- [x] Chose not to implement volume mounting for the Task API
- [x] Changed ConfigMap and observed existing Pod retaining old environment
- [x] Used rollout restart to pick up new configuration
- [x] Applied the same reasoning to Secrets
- [x] Understood Pod-template changes
- [x] Tested a configuration-version annotation
- [x] Observed a new ReplicaSet during rollout
- [x] Distinguished self-healing from rollout
- [x] Understood one-image/multiple-environment architecture
- [x] Understood Base vs environment-specific configuration
- [x] Correctly classified `MONGO_URI` as environment-specific
- [x] Understood why duplicated Deployment manifests create drift
- [x] Completed the Day 6 practical/debugging challenge
- [x] Correctly distinguished manifest files from Kubernetes controllers
- [x] Deferred Kustomize to its proper place

# Day 6 Status

**COMPLETE ✅**

The Task Management application now has a solid Kubernetes configuration-management foundation:

```text
Docker Image
      |
      v
Kubernetes Deployment
      |
      +------------------+
      |                  |
      v                  v
ConfigMap             Secret
      |                  |
      +--------+---------+
               |
               v
          Pod environment
               |
               v
           Task API
```
