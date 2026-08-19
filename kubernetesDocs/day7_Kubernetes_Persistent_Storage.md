# Day 7 — Kubernetes Persistent Storage

## Goal

Day 7 focused on the problem created by ephemeral Pods and containers:

> How do we keep database data when Kubernetes replaces a Pod?

We implemented persistent storage with a real MongoDB workload and deliberately destroyed Pods and storage claims to observe the lifecycle.

Topics:
- container filesystem vs Pod storage
- `emptyDir`
- PersistentVolumeClaim (PVC)
- PersistentVolume (PV)
- StorageClass
- dynamic provisioning
- `WaitForFirstConsumer`
- mounting a PVC into MongoDB at `/data/db`
- persistence across Pod deletion
- PVC protection
- `persistentVolumeReclaimPolicy: Delete`
- `persistentVolumeReclaimPolicy: Retain`
- `Released` PV state
- PVC vs PV mental model
- storage debugging

---

# 1. Why Persistent Storage Is Needed

Pods are ephemeral.

If MongoDB stores its data only inside the container's writable filesystem and the Pod is deleted, the replacement Pod does not automatically inherit the old Pod's filesystem.

Therefore database data needs storage that exists independently of the Pod.

---

# 2. Container Storage vs `emptyDir` vs Persistent Storage

An `emptyDir` belongs to the Pod.

Example:

```yaml
volumes:
  - name: mongo-data
    emptyDir: {}
```

mounted with:

```yaml
volumeMounts:
  - name: mongo-data
    mountPath: /data/db
```

Important behavior:

```text
Container restarts
    ↓
same Pod
    ↓
emptyDir survives
```

But:

```text
Pod deleted
    ↓
emptyDir deleted
```

Therefore:

> `emptyDir` survives container restarts, but does not survive Pod deletion.

It is not appropriate for persistent MongoDB data.

---

# 3. Persistent Storage Architecture

The persistent-storage model:

```text
Pod
 |
 | consumes
 v
PVC
 |
 | binds to
 v
PV
 |
 v
actual storage
```

Mental model:

```text
PVC = request
PV  = supply / provisioned storage
```

A PVC says:

> "I need storage."

A PV represents:

> "Here is a storage resource that can satisfy that request."

---

# 4. MongoDB PVC

We created:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim

metadata:
  name: mongo-pvc

spec:
  accessModes:
    - ReadWriteOnce

  resources:
    requests:
      storage: 1Gi
```

This requested 1 GiB with `ReadWriteOnce`.

`ReadWriteOnce` means the volume can be mounted read-write by a single node.

---

# 5. PVC Initially Became `Pending`

After creating the PVC, we saw:

```text
mongo-pvc   Pending
```

The StorageClass was:

```text
standard (default)
PROVISIONER: rancher.io/local-path
VOLUME BINDING MODE: WaitForFirstConsumer
```

This explained why the PVC initially waited.

---

# 6. `WaitForFirstConsumer`

`WaitForFirstConsumer` is a **StorageClass policy**, not a PVC status.

It means Kubernetes waits until there is a consumer Pod so storage provisioning/binding can take the Pod's scheduling context into account.

Flow:

```text
PVC created
    ↓
Pending
    ↓
MongoDB Pod consumes PVC
    ↓
Pod scheduling context becomes known
    ↓
storage provisioned
    ↓
PV created
    ↓
PVC becomes Bound
```

Our Kind cluster uses:

```text
rancher.io/local-path
```

and the default StorageClass uses:

```text
WaitForFirstConsumer
```

---

# 7. Policy vs Status

The StorageClass continues to show:

```text
volumeBindingMode: WaitForFirstConsumer
```

even after the MongoDB PVC becomes:

```text
Bound
```

This is because `WaitForFirstConsumer` is a policy for future PVC provisioning using that StorageClass.

The PVC has its own lifecycle:

```text
Pending
   ↓
Bound
```

while the StorageClass retains its policy.

---

# 8. Other `volumeBindingMode`

The two important modes covered:

## `Immediate`

```yaml
volumeBindingMode: Immediate
```

Conceptually:

```text
PVC
 ↓
PV provisioned
 ↓
Bound
```

## `WaitForFirstConsumer`

```yaml
volumeBindingMode: WaitForFirstConsumer
```

Conceptually:

```text
PVC
 ↓
Pending
 ↓
consumer Pod
 ↓
provisioning/binding
 ↓
Bound
```

`volumeBindingMode` is a StorageClass policy. Different StorageClasses can use different modes.

---

# 9. Dynamic Provisioning

We did not manually create a PV for MongoDB.

We created the PVC:

```text
PVC
"I need 1Gi"
```

Then the StorageClass dynamically provisioned a PV.

```text
PVC
    ↓
StorageClass: standard
    ↓
rancher.io/local-path
    ↓
PV automatically created
    ↓
PVC ↔ PV Bound
```

This is dynamic provisioning.

---

# 10. Mounting the PVC into MongoDB

MongoDB stores its database files under:

```text
/data/db
```

Our Pod configuration conceptually became:

```yaml
spec:
  containers:
    - name: mongo
      image: mongo:latest

      volumeMounts:
        - name: mongo-data
          mountPath: /data/db

  volumes:
    - name: mongo-data
      persistentVolumeClaim:
        claimName: mongo-pvc
```

Important distinction:

```text
volumeMounts
    ↓
container-side mounting location

volumes
    ↓
Pod-level source of the volume
```

Relationship:

```text
MongoDB container
       |
       | /data/db
       v
   mongo-data
       |
       v
    mongo-pvc
       |
       v
       PV
```

---

# 11. MongoDB Persistence Experiment

Our application was configured with:

```text
mongodb://mongo:27017/taskdb
```

Therefore we entered:

```javascript
use taskdb
```

We created a temporary collection and document:

```javascript
db.persistenceTest.insertOne({
  message: "Kubernetes PVC works!",
  createdAt: new Date()
})
```

`persistenceTest` was simply a test collection name. It was not a special MongoDB class or built-in object.

We verified the data.

---

# 12. Delete MongoDB Pod

We deleted the MongoDB Pod.

Kubernetes created a replacement Pod.

The exact same MongoDB data was still present.

```text
MongoDB Pod #1
      |
      v
/data/db
      |
      v
PVC
      |
      v
PV
      |
      v
test data

Pod #1 deleted
      |
      v
MongoDB Pod #2
      |
      v
same PVC
      |
      v
same PV
      |
      v
same data
```

This experimentally proved:

> Persistent storage survives Pod replacement.

---

# 13. Important Correction

A Pod deletion does **not** delete persistent data when the PVC/PV remain.

Correct model:

```text
Pod deleted
    ↓
PVC remains
    ↓
PV remains
    ↓
persistent data remains
```

---

# 14. PVC vs PV

The best mental model:

```text
PVC = demand/request
PV  = supply/provisioned storage
```

PVC might say:

```text
I need 1Gi
```

PV represents:

```text
Here is 1Gi of storage
```

The relationship can be inspected from both directions.

PVC:

```text
volumeName:
  pvc-d1f8f748-...
```

PV:

```text
claim:
  default/mongo-pvc
```

So:

```text
PVC
  ↓ volumeName
PV

PV
  ↓ claimRef
PVC
```

---

# 15. `volumeMode: Filesystem`

Our PVC used:

```text
volumeMode: Filesystem
```

This is appropriate for MongoDB because the storage is mounted as a filesystem:

```text
PV
 ↓
filesystem
 ↓
/data/db
 ↓
MongoDB
```

---

# 16. `persistentVolumeReclaimPolicy`

Our dynamically provisioned PV had:

```text
persistentVolumeReclaimPolicy: Delete
```

The reclaim policy answers:

> What should happen to the PV/underlying provisioned storage when the PVC is deleted?

The two policies we studied:

```text
Delete
Retain
```

---

# 17. Reclaim Policy: `Delete`

We created a disposable PVC:

```text
test-delete-pvc
```

and consumer Pod:

```text
test-delete-pod
```

Once consumed:

```text
PVC → Bound
PV  → Bound
Pod → Running
```

We deleted the PVC.

It initially became:

```text
Terminating
```

because the Pod was still using it.

After deleting the consumer Pod, the PVC deletion completed.

Because the PV had:

```text
reclaimPolicy: Delete
```

the PV and dynamically provisioned storage were cleaned up.

We verified that the disposable PVC/PV were gone.

---

# 18. PVC Protection

A PVC being actively used by a Pod is protected from immediate deletion.

Our relationship:

```text
test-delete-pod
       |
       v
test-delete-pvc
```

When we requested deletion:

```text
kubectl delete pvc test-delete-pvc
```

the PVC stayed:

```text
Terminating
```

The consumer Pod was still using it.

After:

```text
kubectl delete pod test-delete-pod
```

the PVC deletion completed.

This is an important production safety mechanism.

---

# 19. `Delete` Lifecycle

The important trigger is PVC deletion, not Pod deletion.

```text
Pod deletion
    ↓
PVC remains
    ↓
PV remains
    ↓
data remains
```

But:

```text
PVC deletion
    ↓
reclaim policy evaluated
    ↓
Delete
    ↓
PV/storage cleaned up
```

---

# 20. Reclaim Policy: `Retain`

We created a separate StorageClass:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass

metadata:
  name: test-retain-storage

provisioner: rancher.io/local-path

reclaimPolicy: Retain

volumeBindingMode: WaitForFirstConsumer
```

We created a PVC using:

```yaml
storageClassName: test-retain-storage
```

and verified that the resulting PV showed:

```text
RECLAIM POLICY: Retain
```

---

# 21. Retain Persistence Experiment

We created:

```text
test-retain-pod
test-retain-pvc
```

The Pod mounted the PVC at:

```text
/data
```

We wrote:

```text
This data must survive PVC deletion
```

to:

```text
/data/persistence-test.txt
```

and verified the file.

Then we deleted the Pod and later deleted the PVC.

---

# 22. `Released`

After deleting the Retain PVC, the PV did not disappear.

Instead we saw:

```text
STATUS: Released
```

Meaning:

> The PV was previously bound to a PVC, but that PVC no longer exists.

With `Retain`, the storage is retained and requires administrative handling before reuse.

Lifecycle:

```text
PVC
 ↓
PV
 ↓
Bound

PVC deleted
 ↓
PV
 ↓
Released
```

`Released` does not mean the data has been deleted.

It also does not mean any new PVC will automatically use that PV.

---

# 23. `Delete` vs `Retain`

| Event | `Delete` | `Retain` |
|---|---|---|
| Pod deleted | PVC/PV remain; data survives | PVC/PV remain; data survives |
| PVC deleted | PV/storage can be deleted | PV remains |
| PV after PVC deletion | Deleted | `Released` |
| Underlying storage | Cleaned up | Retained |
| Automatic cleanup | Yes | No |
| Manual recovery/reclaim | Generally not needed | Required when recovering/reusing |

The key distinction:

```text
Pod deletion
    ≠
PVC deletion
```

and:

```text
PVC deletion
    ↓
reclaim policy decides what happens
```

---

# 24. Storage Does Not Equal Backup

Persistent storage protects against Pod replacement, but persistence is not a backup strategy.

It does not automatically protect against:

```text
database corruption
accidental data deletion
storage failure
cluster destruction
ransomware
```

Production databases need separate backup/recovery strategies.

---

# 25. Debugging: `test-delete-pod` Was `Pending`

During the `Delete` experiment, `test-delete-pod` initially showed:

```text
Pending
```

We ran:

```bash
kubectl describe pod test-delete-pod
```

The Events showed:

```text
Successfully assigned ...
Failed to pull image "busybox"
ImagePullBackOff
```

Later:

```text
Successfully pulled image "busybox"
Container created
Container started
```

The important lesson:

> `Pending` does not automatically mean that the Pod cannot be scheduled.

The Pod had actually been assigned to the node. It was waiting on image availability.

The debugging pattern:

```text
kubectl get pods
      ↓
Pending
      ↓
kubectl describe pod <pod>
      ↓
Events
      ↓
actual reason
```

Also, `replicas: 3` in the Task API Deployment had nothing to do with this standalone test Pod. Deployment replicas control only Pods managed by that Deployment.

---

# 26. Important Commands

Inspect Pods:

```bash
kubectl get pods
```

Detailed Pod debugging:

```bash
kubectl describe pod <pod-name>
```

Inspect PVC:

```bash
kubectl get pvc
kubectl get pvc <pvc-name> -o yaml
```

Inspect PV:

```bash
kubectl get pv
kubectl get pv <pv-name> -o yaml
```

Inspect StorageClasses:

```bash
kubectl get storageclass
```

Watch Pods:

```bash
kubectl get pods -w
```

Inspect events:

```bash
kubectl get events --sort-by=.lastTimestamp
```

---

# 27. Day 7 Mental Model

```text
                    StorageClass
                         |
             provisioning policy
                         |
                         v
                        PVC
                  "I need 1Gi"
                         |
                         | binds to
                         v
                        PV
                "Here's the storage"
                         |
                         v
                  Actual storage
                         ^
                         |
                       Pod
                         |
                     /data/db
                         |
                         v
                      MongoDB
```

Lifecycle:

```text
Container restart
    ↓
emptyDir can survive

Pod deletion
    ↓
PVC/PV remain
    ↓
persistent data survives

PVC deletion
    ↓
reclaim policy evaluated

Delete
    ↓
PV/storage cleaned up

Retain
    ↓
PV remains Released
    ↓
storage retained
    ↓
manual recovery/reclaim
```

---

# 28. Day 7 Challenge — Results

## Challenge 1

A. Container restart → data remains. Correct.

B. Pod deletion → persistent data survives when PVC/PV remain. The original answer "data vanishes" was corrected.

C. PVC deletion + Delete → PV and dynamically provisioned storage can be deleted. Correct.

D. PVC deletion + Retain → PV remains Released and data is retained. Correct.

## Challenge 2

The StorageClass waits for a consumer so provisioning/binding can account for the Pod's scheduling context.

```text
PVC
 ↓
Pending
 ↓
consumer Pod
 ↓
scheduling context
 ↓
provisioning
 ↓
PV
 ↓
Bound
```

## Challenge 3

PVC protection prevents immediate deletion while a Pod is consuming the PVC.

We deleted the consumer Pod, after which PVC deletion completed.

## Challenge 4

Correct answer:

```text
C
```

`Released` means the previous claim is gone while retained storage remains for administrative handling.

## Challenge 5

Correct:

```text
PVC = request/claim
PV  = provisioned storage
```

## Challenge 6

Pod failure itself should not cause loss of data stored on persistent storage.

For accidental PVC deletion, `Retain` provides a better safety net than `Delete`, because `Retain` keeps the PV/storage for recovery while `Delete` permits automatic cleanup.

However, Retain does not automatically attach the storage to a replacement Pod; recovery/reclaim is an administrative process.

---

# 29. Day 7 Completion Checklist

- [x] Understood why Pods being ephemeral creates a database-storage problem
- [x] Compared container filesystem and Pod storage
- [x] Learned `emptyDir`
- [x] Understood that `emptyDir` survives container restart but not Pod deletion
- [x] Created a MongoDB PVC
- [x] Understood PVC vs PV
- [x] Observed PVC `Pending`
- [x] Investigated `WaitForFirstConsumer`
- [x] Learned `Immediate` vs `WaitForFirstConsumer`
- [x] Understood that `WaitForFirstConsumer` is a StorageClass policy, not a PVC status
- [x] Observed dynamic provisioning in the Kind cluster
- [x] Observed automatic PV creation
- [x] Mounted the PVC into MongoDB at `/data/db`
- [x] Inserted actual MongoDB data
- [x] Deleted the MongoDB Pod
- [x] Verified the exact same data after Pod replacement
- [x] Inspected PVC ↔ PV relationships
- [x] Learned `volumeMode: Filesystem`
- [x] Learned `persistentVolumeReclaimPolicy`
- [x] Experimented with `Delete`
- [x] Encountered and understood PVC protection
- [x] Investigated a `Pending` Pod using `kubectl describe`
- [x] Experimented with `Retain`
- [x] Verified a PV becomes `Released`
- [x] Understood why `Released` does not mean deleted
- [x] Distinguished persistence from backup
- [x] Completed the Day 7 reasoning challenge

# Day 7 Status

**COMPLETE ✅**

The Task Management application's MongoDB now has a real Kubernetes persistent-storage architecture:

```text
MongoDB Pod
    |
    | /data/db
    v
PVC
    |
    v
PV
    |
    v
StorageClass / local-path storage
```

We experimentally proved that database data survives MongoDB Pod replacement.

We also experimentally observed both PV reclaim behaviors:

```text
Delete  → storage cleaned up
Retain  → PV becomes Released and storage is retained
```
