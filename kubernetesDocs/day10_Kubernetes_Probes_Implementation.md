# Day 10 — Kubernetes Probes: Startup, Liveness & Readiness

## 1. Goal

Day 10 focused on Kubernetes health probes and, importantly, proving their behavior in the actual `ai-task-management-system` Kind cluster.

We covered:

- Startup probe
- Liveness probe
- Readiness probe
- `periodSeconds`
- `failureThreshold`
- `initialDelaySeconds` vs startup probes
- kubelet responsibility
- Pod vs container restart behavior
- Service endpoint behavior
- Probe debugging
- Kustomize placement
- Rolling-update/readiness behavior

Core mental model:

```text
STARTUP   → "Have you started?"
LIVENESS  → "Should I restart you?"
READINESS → "Should I send traffic?"
```

---

# 2. Existing Application Health Endpoint

The Node.js application already had:

```text
GET /health
```

and we verified it through the NodePort:

```powershell
Invoke-WebRequest http://localhost:30080/health
```

Result:

```text
StatusCode        : 200
StatusDescription : OK
Content           : {"status":"ok"}
```

This established the known-good path:

```text
Client
  ↓
NodePort :30080
  ↓
task-api-service
  ↓
Pod :3000
  ↓
/health
  ↓
200 OK
```

The application port is **3000**. `30080` is the NodePort.

---

# 3. Where the Probes Belong in Kustomize

Our structure is:

```text
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── ...
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml
    │   └── .env.secret
    └── prod/
        ├── kustomization.yaml
        └── .env.secret
```

Dev contains:

```yaml
resources:
  - ../../base
```

Therefore `base/deployment.yaml` is the common task-api definition.

Probes are common application behavior, so they belong in:

```text
k8s/base/deployment.yaml
```

The overlays then inherit them.

```text
BASE
 ├── image
 ├── port
 ├── resources
 └── probes
       │
       ├── DEV → replicas 1, debug
       └── PROD → replicas 3, info
```

Apply the Dev environment with:

```powershell
kubectl apply -k overlays/dev
```

Preview with:

```powershell
kubectl kustomize overlays/dev
```

---

# 4. Kubelet

The kubelet on the Worker Node performs the probes.

Conceptually:

```text
Worker Node
┌────────────────────────┐
│ kubelet                │
│    │                   │
│    └── probe request ──┼──→ Pod
└────────────────────────┘
```

For an HTTP probe, kubelet checks the Pod directly.

This is different from a user reaching the application through the Service/NodePort.

---

# 5. Liveness Probe

## Purpose

Liveness asks:

> Is the running application still healthy enough that Kubernetes should keep this container running?

Failure can cause kubelet to restart the container.

Mental model:

```text
Liveness failure
      ↓
kubelet
      ↓
restart container
```

It does not inherently mean that a new ReplicaSet or new Pod is created.

## Configuration used

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  periodSeconds: 10
  failureThreshold: 3
```

Meaning:

- check `/health`
- on port 3000
- periodically
- tolerate repeated failures until the threshold is reached

---

# 6. First Liveness Debugging Session

After adding the liveness probe and applying:

```powershell
kubectl apply -k overlays/dev
```

we saw:

```text
Liveness probe failed:
Get "http://10.244.0.12:3000/health":
dial tcp 10.244.0.12:3000:
connect: connection refused
```

Initial suspicion:

> Maybe port 3000 is wrong.

We did not immediately change it. We investigated.

---

# 7. Check Current Logs

```powershell
kubectl logs <pod>
```

showed:

```text
[nodemon] starting node src/server.js
Server started running on port 3000
RESTART TEST 123
DB connected
```

Therefore the current container was successfully running the application.

---

# 8. Check Previous Container

We also used:

```powershell
kubectl logs <pod> --previous
```

The previous instance showed:

```text
npm error signal SIGTERM
```

This was consistent with Kubernetes terminating the previous container after the probe failure. `SIGTERM` should not automatically be interpreted as proof that Node.js independently crashed.

---

# 9. Test `/health` Inside the Container

We tested:

```text
127.0.0.1:3000/health
```

and received:

```text
STATUS: 200
{"status":"ok"}
```

This proved the application worked through localhost.

But that did not yet prove it worked through the Pod network interface.

---

# 10. Test the Exact Pod IP

The Pod had an IP such as:

```text
10.244.0.12
```

We tested:

```text
10.244.0.12:3000/health
```

and got:

```text
STATUS: 200
{"status":"ok"}
```

This was important because Kubernetes itself was probing the Pod IP.

Therefore we eliminated:

- wrong application port
- localhost-only binding as the primary explanation

We now knew:

```text
127.0.0.1:3000/health → 200
Pod-IP:3000/health    → 200
```

So the earlier connection refusal occurred when the application was not accepting connections at the moment of the probe.

This led into startup-probe behavior.

---

# 11. Startup Probe

## Purpose

Startup asks:

> Has this application successfully completed its startup phase?

It is useful when an application may take time to initialize.

Mental model:

```text
Container starts
      ↓
Startup probe checks
      ↓
startup succeeds
      ↓
normal liveness/readiness behavior proceeds
```

If startup never succeeds within its allowed threshold:

```text
Startup failures
      ↓
threshold exceeded
      ↓
container restart
```

## Configuration used

```yaml
startupProbe:
  httpGet:
    path: /health
    port: 3000
  periodSeconds: 5
  failureThreshold: 12
```

The rough intended startup budget was:

```text
5 × 12 ≈ 60 seconds
```

---

# 12. Startup Probe Debugging

`kubectl describe pod` showed events such as:

```text
Startup probe failed:
Get "http://10.244.0.13:3000/health":
dial tcp 10.244.0.13:3000:
connect: connection refused
```

and events indicating:

```text
Created (x2 ...)
Started (x2 ...)
Killing ...
Startup probe failed ...
```

This demonstrated:

```text
Container instance #1
      ↓
startup probe failed repeatedly
      ↓
container killed
      ↓
Container instance #2
      ↓
startup succeeded
      ↓
container continued running
```

---

# 13. Important: Pod vs Container vs Probe History

One of the most important Day 10 lessons:

```text
Pod lifetime
    ≠
Container lifetime
    ≠
Probe event history
```

A Pod can remain the same while its container is restarted.

Example:

```text
Pod
│
├── Container #1
│     ↓
│   failed
│     ↓
│   killed
│
└── Container #2
      ↓
    running
```

Therefore:

```text
RESTARTS = 1
```

does not necessarily mean the Pod was recreated.

---

# 14. Why `describe` Still Showed Startup Failure

We asked:

> If the application is currently running, why does `kubectl describe pod` still show `Startup probe failed`?

Because the Events section is historical.

It is not a continuous log of every probe result.

Kubernetes does not normally create permanent events like:

```text
Startup successful
Liveness successful
Liveness successful
Liveness successful
...
```

every time a probe passes.

That would produce huge amounts of useless event data.

So this:

```text
Startup probe failed
```

can be a historical event.

It does not mean:

```text
startup is currently failing
```

Current state should be judged using:

```powershell
kubectl get pods
kubectl describe pod <pod>
kubectl logs <pod>
```

plus relevant Service state.

---

# 15. Startup Threshold: Why We Did Not Immediately Increase It

We considered increasing:

```yaml
failureThreshold: 12
```

because the startup probe had failed.

But we did not immediately increase it.

Reason:

```text
Probe failure
   ↓
Investigate actual cause
   ↓
Determine whether startup is truly slow
   ↓
Tune threshold if justified
```

A huge threshold can simply hide an application failure.

Our later observation showed the application successfully started with the existing configuration, so we did not conclude that 60 seconds definitely needed to be increased.

---

# 16. Application Startup Investigation

`src/server.js` contains:

```javascript
require('dotenv').config();

const app = require("./app");

const PORT = process.env.PORT || 3000;

const connectDB = require("./config/db");

connectDB();

app.listen(PORT, () => {
    console.log(`Server started running on port ${PORT}`)
});
```

The DB code:

```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB connected");
  } catch(error) {
    console.log("Database connection failed", error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

Important JavaScript observation:

```javascript
connectDB();
app.listen(...);
```

does not await the async DB connection.

Therefore the HTTP server can start while MongoDB connection is still being established.

Our current logs showed:

```text
Server started running on port 3000
RESTART TEST 123
DB connected
```

So the application can successfully start the HTTP server before the DB connection completes.

We did not change this application architecture during the probe exercise.

---

# 17. Readiness Probe

## Purpose

Readiness asks:

> Is this Pod currently ready to receive traffic through Kubernetes Services?

Failure does **not** normally restart the container.

Mental model:

```text
Readiness failure
      ↓
Pod becomes NotReady
      ↓
Service removes Pod from ready endpoints
      ↓
container continues running
```

---

# 18. Initial Readiness Configuration

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  periodSeconds: 5
  failureThreshold: 3
```

Initially all three probes could use `/health` because we were learning their different effects.

The key difference is not simply the endpoint; it is what Kubernetes does with the result.

---

# 19. Controlled Readiness Failure Experiment

We deliberately changed ONLY readiness to:

```yaml
readinessProbe:
  httpGet:
    path: /gibberish
    port: 3000
  periodSeconds: 5
  failureThreshold: 3
```

Liveness remained:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
```

So the intended state was:

```text
Startup   → success
Liveness  → success
Readiness → failure
```

---

# 20. Readiness Experiment Result

`kubectl get pods` showed:

```text
task-api-64c4545897-wphkw   0/1   Running   0   ...
task-api-6dcb7f668f-4dpzj   1/1   Running   0   ...
```

The important observation:

```text
0/1 Running
```

means:

> The container is running, but the Pod is not Ready.

---

# 21. `describe` Confirmed Readiness Failure

Conditions showed:

```text
Ready            False
ContainersReady  False
PodScheduled     True
```

Events showed:

```text
Readiness probe failed:
HTTP probe failed with statuscode: 404
```

That made sense because `/gibberish` does not exist.

Therefore:

```text
GET /gibberish
      ↓
404
      ↓
Readiness failure
```

---

# 22. Most Important Readiness Observation

The restart count remained:

```text
RESTARTS = 0
```

while the Pod was:

```text
Running
```

Therefore:

```text
Readiness failure
      ↓
does NOT restart the container
```

Instead:

```text
Pod remains Running
Pod becomes NotReady
Service excludes it from ready endpoints
```

This was the cleanest practical demonstration of readiness.

---

# 23. Service Endpoint Experiment

We ran:

```powershell
kubectl get endpoints task-api-service
```

The Service showed the healthy Pod IP:

```text
10.244.0.14:3000
```

The new unready Pod had a different IP:

```text
10.244.0.15
```

The new Pod was therefore absent from the ready Service endpoints.

Conceptually:

```text
Healthy Pod
10.244.0.14:3000
       ↓
Service endpoint ✅

Unready Pod
10.244.0.15:3000
       ↓
Service endpoint ❌
```

This proved that readiness controls Service traffic eligibility.

---

# 24. Readiness Does Not Mean the Pod Cannot Be Contacted Directly

An unready Pod may still technically respond if someone connects directly to its Pod IP.

Readiness means:

> Kubernetes should not consider that Pod an eligible endpoint for normal Service traffic.

Therefore:

```text
Pod IP access
    ≠
Service endpoint eligibility
```

---

# 25. Rolling Update Connection

We asked whether the old Pod is terminated only after the new Pod becomes Ready.

The correct nuanced model is:

> During a Deployment rolling update, readiness is one of the key signals used when determining whether new Pods are available. A Running-but-NotReady new Pod does not count as available for serving traffic, so old healthy Pods may remain running according to the rolling-update strategy.

Our Deployment uses:

```yaml
strategy:
  rollingUpdate:
    maxSurge: 25%
    maxUnavailable: 25%
```

So it is too absolute to say:

> "The old Pod is always terminated only when the new Pod becomes Ready."

Better:

> Readiness contributes to rollout availability and progression; the Deployment controller manages when old ReplicaSet Pods can be scaled down according to the rollout strategy.

---

# 26. Final Three-Probe Comparison

| Probe | Question | Failure effect |
|---|---|---|
| Startup | Has the application finished starting? | If startup never succeeds within the configured budget, container can be restarted |
| Liveness | Is the running application healthy enough to continue? | Container restart |
| Readiness | Should this Pod receive Service traffic? | Pod becomes NotReady and is removed from ready endpoints |

Memorize:

```text
STARTUP   → Have you started?
LIVENESS  → Should I restart you?
READINESS → Should I send traffic?
```

---

# 27. `periodSeconds`

Example:

```yaml
periodSeconds: 10
```

means the probe runs periodically, approximately every 10 seconds.

It is not the same thing as:

```yaml
initialDelaySeconds
```

`initialDelaySeconds` is about delaying the beginning of normal probing.

---

# 28. `failureThreshold`

Example:

```yaml
failureThreshold: 3
```

means repeated failures are tolerated up to the configured threshold before the probe is considered failed.

For liveness:

```text
failure
failure
failure
   ↓
liveness failure
   ↓
restart container
```

For readiness:

```text
failure
failure
failure
   ↓
readiness failure
   ↓
Pod NotReady
   ↓
Service excludes Pod
```

---

# 29. `initialDelaySeconds` vs Startup Probe

`initialDelaySeconds` conceptually says:

> Wait before beginning normal probe checks.

A startup probe says:

> Use a dedicated startup check to determine when application initialization has completed, and protect the startup phase from normal liveness behavior.

Startup probes are useful when startup duration is variable or potentially long.

---

# 30. Debugging Workflow Learned

When a probe fails:

### 1. Check Pods

```powershell
kubectl get pods
```

Look at:

```text
READY
STATUS
RESTARTS
AGE
```

### 2. Describe

```powershell
kubectl describe pod <pod>
```

Look at:

- probe configuration
- Conditions
- Events
- exact failure message

### 3. Logs

```powershell
kubectl logs <pod>
```

### 4. Previous container

```powershell
kubectl logs <pod> --previous
```

if a previous container instance is available.

### 5. Test the application

Test:

```text
127.0.0.1:3000/health
```

and, when relevant:

```text
Pod-IP:3000/health
```

### 6. Check Service endpoints for readiness issues

```powershell
kubectl get endpoints task-api-service
```

This structured process is better than immediately changing probe thresholds.

---

# 31. Important Debugging Distinctions

## `connection refused`

Usually means the TCP connection could not be established.

Example:

```text
Pod-IP:3000
connection refused
```

Possible causes include:

- application not listening yet
- application stopped/crashed
- wrong port
- network/interface issue

## HTTP 404

The connection reached the application, but the requested route does not exist.

Our readiness experiment produced:

```text
/gibberish → 404
```

This was useful because it proved the application was reachable while readiness deliberately failed.

---

# 32. Service vs Pod-IP Debugging

External request:

```text
localhost:30080
    ↓
NodePort
    ↓
Service
    ↓
Pod
```

Probe:

```text
kubelet
    ↓
Pod-IP:3000
```

Therefore, a successful Service request does not automatically prove that the specific Pod being probed is reachable at the probe address.

Testing the Pod IP helped isolate this.

---

# 33. Key Day 10 Questions We Answered

### Why does liveness failure restart the container?

Because liveness is the signal used to determine that the running container should be restarted.

### Why doesn't readiness failure restart it?

Because readiness is about traffic eligibility, not container survival.

### Can a Pod be Running but not Ready?

Yes:

```text
0/1 Running
```

### Can liveness be healthy while readiness fails?

Yes. We deliberately demonstrated exactly that.

### Why can the old Pod remain while a new Pod is `0/1 Running`?

Because the new Pod is not yet considered available/ready, and the Deployment's rolling-update strategy manages availability while progressing the rollout.

### Why doesn't `describe` show every successful probe?

Because Events are not a continuous probe-result log. Successful probes are not normally recorded as persistent events.

### Does Pod age equal container age?

No.

A Pod can remain while its container is restarted.

### Does a liveness restart create a new ReplicaSet?

No. A liveness restart is a kubelet/container lifecycle action, not a Deployment rollout.

### Does changing a Pod template create a new ReplicaSet?

Yes. That is a Deployment rollout mechanism and is distinct from a container restart caused by liveness.

---

# 34. Final Day 10 Architecture

```text
                         Kubernetes
                              │
                         Worker Node
                              │
                           kubelet
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ↓                   ↓                   ↓
      STARTUP             LIVENESS            READINESS
      "Started?"           "Alive?"            "Ready?"
          │                   │                   │
          │                   │                   │
       failure             failure             failure
          │                   │                   │
          ↓                   ↓                   ↓
    restart if          restart container    Pod NotReady
    threshold              via kubelet            │
    exceeded                                      ↓
                                           Service removes
                                           ready endpoint
```

---

# 35. Final Configuration

After the controlled readiness experiment, readiness was restored to `/health`.

Final intended configuration:

```yaml
startupProbe:
  httpGet:
    path: /health
    port: 3000
  periodSeconds: 5
  failureThreshold: 12

livenessProbe:
  httpGet:
    path: /health
    port: 3000
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  periodSeconds: 5
  failureThreshold: 3
```

The cluster was restored to the healthy readiness configuration after the experiment.

---

# 36. Day 10 Commands

```powershell
kubectl get pods

kubectl get pods -o wide

kubectl describe pod <pod-name>

kubectl logs <pod-name>

kubectl logs <pod-name> --previous

kubectl get svc

kubectl get endpoints task-api-service

kubectl kustomize overlays/dev

kubectl apply -k overlays/dev
```

---

# 37. Final Mental Model

```text
                 Container starts
                       │
                       ↓
                  STARTUP PROBE
                       │
                  "Have you started?"
                       │
                       ↓
                Startup succeeds
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
        LIVENESS             READINESS
       "Are you alive?"     "Are you ready?"
             │                   │
          failure             failure
             │                   │
             ↓                   ↓
      Restart container      Pod NotReady
                                 │
                                 ↓
                         Service excludes Pod
```

The three phrases to permanently remember:

```text
STARTUP   → Have you started?
LIVENESS  → Should I restart you?
READINESS → Should I send traffic?
```

---
