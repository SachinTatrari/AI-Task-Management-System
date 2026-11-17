# Day 11 – Kubernetes Scheduling

## 1. What is Kubernetes Scheduling?

Kubernetes scheduling is the process of deciding which worker node should run a newly created Pod.

When a Pod is created, it initially has no node assigned. The Kubernetes Scheduler evaluates available nodes and selects a suitable one based on scheduling constraints, resource availability, affinity rules, taints, tolerations, and other scheduling factors.

**Basic flow:**

1. A Pod is created and stored through the API server.
2. The Pod remains Pending until it is scheduled.
3. The Scheduler evaluates eligible nodes.
4. The Scheduler selects a suitable node and binds the Pod to it.
5. The kubelet on that node starts the Pod.

The scheduler makes placement decisions; the kubelet handles running the Pod on its assigned node.

---

## 2. Labels and Selectors

### Labels

Labels are key-value pairs attached to Kubernetes objects. They help identify and organize resources.

Example:

```yaml
metadata:
  labels:
    app: task-api
    environment: development
```

A Node can also have labels:

```powershell
kubectl label node devops-lab-control-plane workload=application
```

This adds the label `workload=application` to the Node object.

### Selectors

Selectors identify objects based on their labels.

For example, a Service can select Pods using:

```yaml
selector:
  app: task-api
```

This means the Service selects Pods with the label `app=task-api`.

**Important distinction:**

- Pod labels identify Pods.
- Node labels describe Nodes.
- Pod selectors can select Pods.
- Node selectors and Node Affinity use Node labels to influence Pod placement.

---

## 3. Node Selector

`nodeSelector` is the simplest way to constrain a Pod to nodes with particular labels.

Example:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: database-test
spec:
  nodeSelector:
    workload: database
  containers:
    - name: nginx
      image: nginx:1.27
```

The Pod can only be scheduled on a Node with:

```yaml
workload: database
```

### Practical test

Our Kind cluster had one Node:

`devops-lab-control-plane`

We labelled it:

```powershell
kubectl label node devops-lab-control-plane workload=application
```

We then attempted to schedule a Pod requiring:

```yaml
nodeSelector:
  workload: database
```

The Pod remained Pending.

The scheduling event reported:

```text
0/1 nodes are available:
1 node(s) didn't match Pod's node affinity/selector.
```

**Conclusion:** A `nodeSelector` is a hard scheduling constraint. If no Node matches, the Pod cannot be scheduled.

---

## 4. Node Affinity

Node Affinity is a more expressive mechanism for controlling Pod placement using Node labels.

It supports both hard requirements and soft preferences.

### 4.1 Required Node Affinity

`requiredDuringSchedulingIgnoredDuringExecution` defines a hard requirement.

Example:

```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: workload
              operator: In
              values:
                - application
```

Meaning:

- The Node must have the label key `workload`.
- Its value must be `application`.
- If no Node matches, the Pod remains Pending.

### 4.2 Preferred Node Affinity

`preferredDuringSchedulingIgnoredDuringExecution` defines a soft preference.

Example:

```yaml
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
            - key: workload
              operator: In
              values:
                - database
```

Meaning:

- The scheduler prefers Nodes labelled `workload=database`.
- If no matching Node is available, it can select another suitable Node.
- The preference does not guarantee placement on a matching Node.

### Understanding weight

The weight ranges from 1 to 100.

For example:

- Weight 100 represents a stronger preference.
- Weight 50 represents a weaker preference.

Weight is not a probability or percentage. It contributes to the scheduler's scoring process. Other scheduling plugins also influence the final Node selection.

### Required vs Preferred

| Feature | Required | Preferred |
|---|---|---|
| Behaviour | Hard constraint | Soft preference |
| Matching Node required? | Yes | No |
| If no matching Node exists | Pod remains Pending | Scheduler can choose another suitable Node |
| Configuration | `requiredDuringSchedulingIgnoredDuringExecution` | `preferredDuringSchedulingIgnoredDuringExecution` |

### Meaning of IgnoredDuringExecution

Suppose a Pod is already running on a Node labelled:

```text
workload=application
```

Later, someone changes that Node's label to:

```text
workload=database
```

The existing Pod is not automatically evicted just because its Node no longer satisfies the original affinity rule.

`IgnoredDuringExecution` means the rule is considered during scheduling, but a later label change does not itself trigger eviction.

---

## 5. Node Affinity Operators

Node Affinity supports different operators for matching labels.

| Operator | Meaning |
|---|---|
| `In` | Label value must match one of the specified values |
| `NotIn` | Label value must not match the specified values |
| `Exists` | Label key must exist |
| `DoesNotExist` | Label key must not exist |
| `Gt` | Label value must be greater than the specified value |
| `Lt` | Label value must be less than the specified value |

Example:

```yaml
matchExpressions:
  - key: workload
    operator: In
    values:
      - application
      - database
```

This matches either `workload=application` or `workload=database`.

### AND and OR behaviour

Within one `matchExpressions` list, all expressions must match (AND).

Separate `nodeSelectorTerms` are alternatives (OR).

This distinction is important when building more complex scheduling rules.

---

## 6. Taints and Tolerations

Node Affinity helps attract Pods towards suitable Nodes.

Taints and tolerations work in the opposite direction: they help Nodes repel Pods that are not allowed to use them.

### 6.1 What is a Taint?

A taint is applied to a Node.

Example:

```powershell
kubectl taint nodes devops-lab-control-plane workload=database:NoSchedule
```

The structure is:

```text
key=value:effect
```

In this example:

- Key: `workload`
- Value: `database`
- Effect: `NoSchedule`

The Node now repels Pods that do not have a matching toleration.

### Where is the taint stored?

A taint is part of the Kubernetes Node object's specification.

Conceptually:

```yaml
spec:
  taints:
    - key: workload
      value: database
      effect: NoSchedule
```

When we execute `kubectl taint`, kubectl sends the request to the API server. The Node object is updated and the resulting cluster state is stored in etcd.

We do not need to create a separate YAML file for this imperative command.

### 6.2 What is a Toleration?

A toleration is configured in a Pod specification.

Example:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: taint-test-tolerant
spec:
  containers:
    - name: nginx
      image: nginx:1.27
  tolerations:
    - key: workload
      operator: Equal
      value: database
      effect: NoSchedule
```

This Pod tolerates the taint:

```text
workload=database:NoSchedule
```

The toleration matches the key, value, operator and effect.

### Critical distinction

**A toleration does not attract a Pod to a Node.**

It only allows the Pod to tolerate the matching taint.

If you want a Pod to run on a particular Node, combine tolerations with Node Affinity or `nodeSelector`.

---

## 7. Three Taint Effects

### 7.1 NoSchedule

```text
workload=database:NoSchedule
```

- New Pods without a matching toleration cannot be scheduled on the Node.
- Existing Pods are not evicted just because this taint is added.

### 7.2 PreferNoSchedule

```text
maintenance=true:PreferNoSchedule
```

- The scheduler tries to avoid placing new Pods on this Node.
- It is a soft preference, not a hard restriction.
- If necessary, the scheduler can still place a Pod there.

### 7.3 NoExecute

```text
maintenance=true:NoExecute
```

- New Pods without a matching toleration cannot be scheduled on the Node.
- Existing Pods without a matching toleration are evicted.
- A matching toleration can prevent eviction.

A toleration can include `tolerationSeconds`:

```yaml
tolerations:
  - key: maintenance
    operator: Equal
    value: "true"
    effect: NoExecute
    tolerationSeconds: 60
```

This allows the Pod to tolerate the matching NoExecute taint for 60 seconds. If the taint remains, the Pod is then evicted.

If `tolerationSeconds` is omitted for a matching NoExecute toleration, the toleration has no time limit.

---

## 8. Practical Exercises Completed

### Exercise 1: Node label and Node Selector

- Added `workload=application` to the Kind Node.
- Created a Pod requiring `workload=database`.
- Observed that the Pod remained Pending.
- Inspected the scheduling event to understand the mismatch.

### Exercise 2: Required and Preferred Node Affinity

- Tested required affinity with a matching Node label.
- Observed that a mismatch prevented scheduling.
- Changed the rule to preferred affinity.
- Observed that the Pod could run even when its preference was not satisfied.

### Exercise 3: NoSchedule

Applied:

```powershell
kubectl taint nodes devops-lab-control-plane workload=database:NoSchedule
```

Created a Pod without a matching toleration:

```powershell
kubectl run taint-test --image=nginx:1.27 --restart=Never
```

The Pod remained Pending.

The event reported an untolerated taint.

### Exercise 4: Toleration

Created a Pod with a matching toleration using a PowerShell here-string:

```powershell
$yaml = @'
apiVersion: v1
kind: Pod
metadata:
  name: taint-test-tolerant
spec:
  containers:
    - name: nginx
      image: nginx:1.27
  tolerations:
    - key: workload
      operator: Equal
      value: database
      effect: NoSchedule
'@

$yaml | kubectl apply -f -
```

This demonstrated how a Pod can tolerate a Node taint.

### Exercise 5: PreferNoSchedule

Added a second taint:

```powershell
kubectl taint nodes devops-lab-control-plane maintenance=true:PreferNoSchedule
```

Inspected the Node object:

```powershell
kubectl get node devops-lab-control-plane -o yaml
```

Confirmed that `maintenance=true:PreferNoSchedule` was stored in `spec.taints`.

Created a Pod that tolerated the existing `workload=database:NoSchedule` taint but did not tolerate `maintenance=true:PreferNoSchedule`.

This demonstrated that `PreferNoSchedule` is a soft preference rather than a hard scheduling block.

---

## 9. Debugging and Environment Notes

### Single-node Kind cluster

Our original cluster:

```text
kind-devops-lab
```

Contained one Node:

```text
devops-lab-control-plane
```

This was sufficient to demonstrate hard scheduling constraints, soft preferences, taints and tolerations.

However, a single-node cluster cannot demonstrate realistic distribution across multiple Nodes.

### Multi-node Kind cluster attempt

We attempted to create a separate cluster with one control-plane Node and three worker Nodes.

The cluster creation repeatedly failed with a Kind startup log detection error:

```text
could not find a log line that matches
"Reached target .*Multi-User System.*|detected cgroup v1"
```

We investigated:

- Kind versions 0.31.0 and 0.33.0
- Docker Desktop and Docker Engine versions
- cgroup v2
- WSL 2 environment
- systemd startup and container logs
- Kind node image startup behaviour

The issue was not conclusively diagnosed. We parked the multi-node experiment rather than spending more time troubleshooting it.

**Important:** The original application cluster remained separate and healthy.

---

## 10. Practical Exercises Deferred

These are not marked as completed.

### A. NoExecute eviction experiment

We studied the effect conceptually but did not apply a NoExecute taint to our application Node.

Reason: this is a single-node cluster containing application workloads. Applying a NoExecute taint could evict Pods that do not tolerate it and disrupt the application.

We should perform this experiment later in an isolated test cluster.

### B. Multi-node scheduling comparison

We have not yet compared multiple Nodes with different labels and multiple weighted Node Affinity preferences.

This requires a working multi-node environment.

---

## 11. Essential Commands for Revision

```powershell
# List Nodes
kubectl get nodes

# View Node labels
kubectl get nodes --show-labels

# Add a Node label
kubectl label node devops-lab-control-plane workload=application

# Inspect a Node
kubectl describe node devops-lab-control-plane

# Inspect complete Node YAML
kubectl get node devops-lab-control-plane -o yaml

# Add a NoSchedule taint
kubectl taint nodes devops-lab-control-plane workload=database:NoSchedule

# Add a PreferNoSchedule taint
kubectl taint nodes devops-lab-control-plane maintenance=true:PreferNoSchedule

# Inspect Pod scheduling events
kubectl describe pod taint-test

# Inspect Pod placement
kubectl get pods -o wide

# Remove a taint (minus sign at the end)
kubectl taint nodes devops-lab-control-plane workload=database:NoSchedule-

# Remove the second taint
kubectl taint nodes devops-lab-control-plane maintenance=true:PreferNoSchedule-

# Delete disposable test Pods
kubectl delete pod taint-test taint-test-tolerant prefer-test --ignore-not-found
```

---

## 12. Day 11 – Final Takeaways

1. The Scheduler selects a suitable Node for each unscheduled Pod.
2. Node labels provide the information used by selectors and affinity rules.
3. `nodeSelector` provides simple hard constraints.
4. Node Affinity supports both required constraints and weighted preferences.
5. Taints repel Pods; tolerations allow Pods to tolerate those taints.
6. `NoSchedule` blocks new non-tolerating Pods.
7. `PreferNoSchedule` is a soft scheduling preference.
8. `NoExecute` can evict existing non-tolerating Pods.
9. A toleration does not guarantee that a Pod will be placed on a particular Node.
10. Realistic multi-node scheduling is best explored in a multi-node cluster.


