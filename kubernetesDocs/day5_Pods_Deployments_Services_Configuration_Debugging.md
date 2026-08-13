# Day 5 --- Kubernetes: Pods, Deployments, Services, Configuration & Debugging

## 1. Day 5 Goal

The goal of Day 5 was to move the Task Management application from a
Docker/Compose mindset into a Kubernetes architecture.

By the end of the day, the application was running end-to-end:

``` text
Windows
   |
   | localhost:30080
   v
Docker Desktop
   |
   v
Kind control-plane node
   |
   v
NodePort
   |
   v
Task API Service
   |
   +----------+----------+
   |          |          |
   v          v          v
 Task API   Task API   Task API
   Pod        Pod        Pod
              |
              | MONGO_URI
              v
          Mongo Service
              |
              v
          MongoDB Pod
```

Final verification:

``` text
http://localhost:30080/health
```

returned the expected health response.

------------------------------------------------------------------------

# 2. Kubernetes Mental Model

Kubernetes is a system that continuously works to maintain a desired
state.

If a Deployment says:

``` yaml
replicas: 3
```

Kubernetes continuously tries to make reality match that desired state.

If one Pod disappears:

``` text
3 Pods
   |
   | delete one
   v
2 Pods
   |
   | ReplicaSet notices
   v
replacement Pod
   |
   v
3 Pods again
```

This is reconciliation/self-healing.

------------------------------------------------------------------------

# 3. Control Plane, Nodes and `kubectl`

We created:

``` bash
kind create cluster --name devops-lab
```

A simplified mental model is:

``` text
kubectl
   |
   v
API Server
   |
   +--------------------+
   |                    |
   v                    v
Controllers          Scheduler
   |                    |
   +---------+----------+
             |
             v
          Kubelet
             |
             v
        containerd
             |
             v
        Containers
```

`kubectl` is the command-line client used to communicate with the
Kubernetes API server. It is not Kubernetes itself.

Examples:

``` bash
kubectl get pods
kubectl apply -f deployment.yaml
kubectl delete pod <pod-name>
```

------------------------------------------------------------------------

# 4. Kubernetes Contexts

The current kubectl context determines which cluster/API server receives
commands.

Useful commands:

``` bash
kubectl config get-contexts
kubectl config current-context
kubectl config use-context <context-name>
```

Mental model:

``` text
kubectl
   |
   | current context
   v
specific Kubernetes cluster
```

`kubectl apply -f deployment.yaml` uses the current context. The YAML
filename does not select the cluster.

------------------------------------------------------------------------

# 5. Docker Images and Kind

Our application image:

``` text
ai-task-management-system-app:latest
```

was built locally.

Because Kind uses containers as Kubernetes nodes, we loaded the local
image into the Kind cluster:

``` bash
kind load docker-image ai-task-management-system-app:latest --name devops-lab
```

We initially loaded the wrong name:

``` text
ai-task-management-system:latest
```

while the Deployment requested:

``` text
ai-task-management-system-app:latest
```

This caused:

``` text
ImagePullBackOff
```

The correct command fixed it:

``` bash
kind load docker-image ai-task-management-system-app:latest --name devops-lab
```

To verify the image inside the Kind node:

``` bash
docker exec devops-lab-control-plane crictl images | grep ai-task
```

## `docker stats` clarification

`docker stats` shows CPU, memory, network I/O and block I/O for
containers. It does not provide application-image import progress.

------------------------------------------------------------------------

# 6. Pods

A Pod is the smallest deployable unit in Kubernetes.

Our Deployment maintained three Task API Pods.

Example:

``` text
task-api-xxxxxxxxxx-xxxxx
task-api-xxxxxxxxxx-yyyyy
task-api-xxxxxxxxxx-zzzzz
```

Pod names/suffixes are not stable identities.

Pods are disposable, which is why clients should not depend directly on
a specific Pod IP.

A Pod can contain multiple tightly coupled containers:

``` text
Pod
 |
 +-- Task API container
 |
 +-- tightly coupled sidecar/logging container
```

Multiple containers belong in the same Pod when they genuinely need that
tight coupling.

------------------------------------------------------------------------

# 7. Deployment → ReplicaSet → Pods

Our simplified hierarchy:

``` text
Deployment
     |
     v
ReplicaSet
     |
     +---- Pod
     +---- Pod
     +---- Pod
```

The Deployment manages the desired workload state and its ReplicaSet.

The ReplicaSet maintains the desired number of Pods.

We tested self-healing by deleting a Pod. Kubernetes immediately created
a replacement.

This demonstrates:

> We declare desired state; Kubernetes controllers continuously
> reconcile reality toward that state.

------------------------------------------------------------------------

# 8. Labels and Selectors

Pod label:

``` yaml
labels:
  app: task-api
```

A label is metadata attached to an object.

A selector:

``` yaml
selector:
  app: task-api
```

is a matching rule used to find objects with matching labels.

Mental model:

``` text
Label
  = information attached to an object

Selector
  = rule for finding matching objects
```

Our Service uses the selector to discover Task API Pods.

------------------------------------------------------------------------

# 9. Services

Pods are ephemeral. Their IPs can change when Pods are recreated.

Bad architecture:

``` text
Client
  |
  +----> fixed Pod IP
```

Better:

``` text
Client
  |
  v
Service
  |
  +---- Pod
  +---- Pod
  +---- Pod
```

A Service provides a stable networking abstraction in front of changing
Pods.

------------------------------------------------------------------------

# 10. ClusterIP

ClusterIP is the normal internal Service type.

Our MongoDB Service uses ClusterIP because MongoDB does not need to be
exposed to Windows.

``` text
Task API Pod
     |
     | mongo:27017
     v
Mongo Service (ClusterIP)
     |
     v
MongoDB Pod
```

------------------------------------------------------------------------

# 11. NodePort

Our Task API Service became:

``` yaml
spec:
  type: NodePort
```

with:

``` yaml
ports:
  - port: 3000
    targetPort: 3000
    nodePort: 30080
```

Three different ports:

### `port`

The Service port:

``` text
Service :3000
```

### `targetPort`

The application port on the selected Pod:

``` text
Pod :3000
```

### `nodePort`

The port exposed through the Kubernetes node:

``` text
Node :30080
```

Traffic path:

``` text
Windows :30080
      |
      v
NodePort :30080
      |
      v
Service :3000
      |
      v
Pod :3000
```

------------------------------------------------------------------------

# 12. Why `localhost:31946` Initially Failed

Our first NodePort was:

``` text
31946
```

but:

``` bash
docker port devops-lab-control-plane
```

showed only the Kubernetes API port mapping, not the NodePort.

Kind's Kubernetes node is itself a Docker container. The Kubernetes
NodePort existing inside the Kind network does not automatically mean
Windows can access that port.

The Kubernetes API server port:

``` text
6443
```

is different from the application NodePort.

We recreated Kind with:

``` yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4

nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30080
        hostPort: 30080
        protocol: TCP
```

and used:

``` yaml
nodePort: 30080
```

Then:

``` bash
docker port devops-lab-control-plane
```

showed:

``` text
30080/tcp -> 0.0.0.0:30080
```

This allowed:

``` text
Windows
  |
  | localhost:30080
  v
Docker port mapping
  |
  v
Kind node
  |
  v
NodePort
```

------------------------------------------------------------------------

# 13. Service Endpoints

A Service uses its selector to find matching Pods.

Useful commands:

``` bash
kubectl get endpoints task-api-service
kubectl get endpoints mongo
```

An endpoint such as:

``` text
10.244.x.x:27017
```

means the Service has a backend at that IP/port.

Mental model:

``` text
Service selector
      |
      v
matching Pods
      |
      v
Endpoints
```

------------------------------------------------------------------------

# 14. ConfigMaps

Our application initially had:

``` text
MONGO_URI = undefined
```

The `.env` file was intentionally excluded through `.dockerignore`.

That is actually desirable: database configuration should not be baked
into the image.

We created:

``` yaml
apiVersion: v1
kind: ConfigMap

metadata:
  name: task-api-config

data:
  NODE_ENV: development
  PORT: "3000"
```

and injected values:

``` yaml
env:
  - name: NODE_ENV
    valueFrom:
      configMapKeyRef:
        name: task-api-config
        key: NODE_ENV

  - name: PORT
    valueFrom:
      configMapKeyRef:
        name: task-api-config
        key: PORT
```

Verification:

``` bash
kubectl exec deploy/task-api -- printenv NODE_ENV
kubectl exec deploy/task-api -- printenv PORT
```

Result:

``` text
development
3000
```

------------------------------------------------------------------------

# 15. `.dockerignore` vs Docker Compose

`.dockerignore` affects the files sent into a Docker build context.

It does NOT control which Docker Compose services are created.

Compose creates services because they are declared in
`docker-compose.yml`.

For example:

``` yaml
services:

  app:
    build: .

  mongo:
    image: mongo
```

Compose creates both because both are declared.

Kubernetes does not automatically read our Compose file. We must
explicitly create Kubernetes resources.

------------------------------------------------------------------------

# 16. Secrets

Sensitive configuration belongs in a Kubernetes Secret.

Our Compose configuration contained:

``` text
MONGO_URI=mongodb://mongo:27017/taskdb
```

We created:

``` bash
kubectl create secret generic task-api-secret --from-literal=MONGO_URI="mongodb://mongo:27017/taskdb"
```

and injected it:

``` yaml
- name: MONGO_URI
  valueFrom:
    secretKeyRef:
      name: task-api-secret
      key: MONGO_URI
```

Important:

``` text
ConfigMap
  -> non-sensitive configuration

Secret
  -> sensitive configuration
```

Both are subject to Kubernetes access control/RBAC.

A Secret does not mean only one particular user can access it.

------------------------------------------------------------------------

# 17. Secret YAML Debugging

We initially made this mistake:

``` yaml
- name: MONGO_URI
  valueFrom:
    key: MONGO_URI
    name: task-api-secret
```

Correct:

``` yaml
- name: MONGO_URI
  valueFrom:
    secretKeyRef:
      name: task-api-secret
      key: MONGO_URI
```

The error:

``` text
unknown field "...valueFrom.key"
```

was caused by putting `key` and `name` at the wrong level.

Correct mental model:

``` text
valueFrom
   |
   +-- configMapKeyRef
   |      +-- name
   |      +-- key
   |
   +-- secretKeyRef
          +-- name
          +-- key
```

------------------------------------------------------------------------

# 18. MongoDB Deployment

We explicitly created MongoDB in Kubernetes:

``` yaml
apiVersion: apps/v1
kind: Deployment

metadata:
  name: mongo

spec:
  replicas: 1

  selector:
    matchLabels:
      app: mongo

  template:
    metadata:
      labels:
        app: mongo

    spec:
      containers:
        - name: mongo
          image: mongo:latest
          ports:
            - containerPort: 27017
```

Mongo initially showed:

``` text
0/1 ContainerCreating
```

because the Mongo image was being downloaded into the Kind node.

After the image pull completed:

``` text
1/1 Running
```

------------------------------------------------------------------------

# 19. MongoDB Service and Kubernetes DNS

We created:

``` yaml
apiVersion: v1
kind: Service

metadata:
  name: mongo

spec:
  selector:
    app: mongo

  ports:
    - port: 27017
      targetPort: 27017
```

This creates a stable Service/DNS name:

``` text
mongo
```

Therefore:

``` text
mongodb://mongo:27017/taskdb
```

works from the Task API Pod.

The path is:

``` text
Task API Pod
     |
     | mongo:27017
     v
Kubernetes DNS
     |
     v
Mongo Service
     |
     v
MongoDB Pod
```

------------------------------------------------------------------------

# 20. Final Working Architecture

``` text
                         WINDOWS
                            |
                            | localhost:30080
                            v
                    Docker Desktop
                            |
                            v
                  Kind control-plane
                            |
                            v
                     NodePort 30080
                            |
                            v
                  Task API Service
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
          Task API       Task API       Task API
            Pod            Pod            Pod
             |              |              |
             +--------------+--------------+
                            |
                       MONGO_URI
                            |
                            v
                      Mongo Service
                            |
                            v
                       MongoDB Pod
                         :27017
```

Configuration:

``` text
ConfigMap
  |
  +-- NODE_ENV=development
  +-- PORT=3000

Secret
  |
  +-- MONGO_URI=mongodb://mongo:27017/taskdb
```

Final test:

``` text
http://localhost:30080/health
```

worked successfully.

------------------------------------------------------------------------

# 21. Debugging Playbook

## `ImagePullBackOff`

Check:

``` bash
kubectl describe pod <pod-name>
```

Look for image errors.

Verify the Deployment image:

``` bash
kubectl get deployment task-api -o yaml
```

Verify the image inside Kind:

``` bash
docker exec devops-lab-control-plane crictl images | grep ai-task
```

For local Kind images:

``` bash
kind load docker-image <image>:<tag> --name devops-lab
```

------------------------------------------------------------------------

## `ContainerCreating`

Do not immediately assume the application is broken.

Check:

``` bash
kubectl describe pod <pod-name>
```

Look at:

``` text
Events:
```

Possible causes include image pulling, mounts, runtime/sandbox issues,
etc.

Our Mongo case was simply the image being downloaded.

------------------------------------------------------------------------

## Pod is `Running` but application doesn't respond

Remember:

``` text
Pod Running
    !=
Application Healthy
```

Check:

``` bash
kubectl logs <pod-name>
```

Check the application's listening port.

Check environment:

``` bash
kubectl exec <pod-name> -- printenv
```

Check connectivity from inside the cluster.

------------------------------------------------------------------------

## `MONGO_URI` undefined

Check:

``` bash
kubectl exec deploy/task-api -- printenv MONGO_URI
```

If empty:

1.  Check Secret.
2.  Check Deployment `secretKeyRef`.
3.  Check key name.
4.  Confirm Pods were recreated after changing the Deployment.

------------------------------------------------------------------------

## `getaddrinfo EAI_AGAIN mongo`

Interpret as a DNS-resolution failure at the time of the connection
attempt.

Check:

``` bash
kubectl get service mongo
kubectl get endpoints mongo
```

Test DNS from the application Pod:

``` bash
kubectl exec deploy/task-api -- node -e "require('dns').lookup('mongo',(e,a)=>console.log(e||a))"
```

Test TCP:

``` bash
kubectl exec deploy/task-api -- node -e "const net=require('net'); const s=net.connect(27017,'mongo',()=>{console.log('CONNECTED');s.end()}); s.on('error',e=>console.log('ERROR:',e.message))"
```

We performed both tests and confirmed the MongoDB Service was reachable.

------------------------------------------------------------------------

# 22. Important Commands

## Cluster

``` bash
kind create cluster --name devops-lab
kind delete cluster --name devops-lab
kind get clusters
```

## Context

``` bash
kubectl config get-contexts
kubectl config current-context
kubectl config use-context <context>
```

## Apply

``` bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

## Workloads

``` bash
kubectl get pods
kubectl get pods -o wide
kubectl get deployments
kubectl get replicasets
```

## Services

``` bash
kubectl get services
kubectl get endpoints
kubectl get endpoints <service-name>
```

## Debugging

``` bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl logs deployment/<deployment-name>
kubectl get events --sort-by=.lastTimestamp
```

## Inside Pods

``` bash
kubectl exec deploy/task-api -- printenv NODE_ENV
kubectl exec deploy/task-api -- printenv PORT
kubectl exec deploy/task-api -- printenv MONGO_URI
```

## Rollout

``` bash
kubectl rollout restart deployment/task-api
```

## Images

``` bash
kind load docker-image ai-task-management-system-app:latest --name devops-lab
docker exec devops-lab-control-plane crictl images
```

------------------------------------------------------------------------

# 23. Day 5 Conceptual Questions

Answer without looking back.

### Q1

What is `kubectl`?

### Q2

What does a Kubernetes context determine?

### Q3

Why should a client not depend directly on a Pod IP?

### Q4

What is the relationship between Deployment, ReplicaSet and Pod?

### Q5

What happens when one Pod is manually deleted from a Deployment with
`replicas: 3`?

### Q6

What is the difference between a label and a selector?

### Q7

Why do we need a Service if Pods already have IP addresses?

### Q8

What is the difference between `port`, `targetPort`, and `nodePort`?

### Q9

Why was `localhost:31946` initially unreachable?

### Q10

What does ClusterIP provide?

### Q11

Why is MongoDB using ClusterIP instead of NodePort?

### Q12

Why doesn't Kubernetes automatically use our Docker Compose file?

### Q13

What does `.dockerignore` affect?

### Q14

Why is excluding `.env` from the Docker image a good practice?

### Q15

What is the difference between ConfigMap and Secret?

### Q16

Does a Kubernetes Secret automatically mean only one user can access it?

### Q17

How does `mongodb://mongo:27017/taskdb` find the MongoDB Pod?

### Q18

What does `ImagePullBackOff` generally indicate?

### Q19

What does `ContainerCreating` mean?

### Q20

Does `Running` guarantee that the application is healthy?

------------------------------------------------------------------------

# 24. Day 5 Debugging Questions

## Scenario 1

``` text
Deployment: 3/3
Pods: 3
Status: ImagePullBackOff
```

What would you investigate first?

## Scenario 2

``` text
Pods: Running
Service: NodePort
localhost:<nodePort>: connection refused
```

What layers would you check?

## Scenario 3

``` text
Mongoose:
MONGO_URI is undefined
```

What would you inspect?

## Scenario 4

``` text
MONGO_URI=mongodb://mongo:27017/taskdb
getaddrinfo EAI_AGAIN mongo
```

What does `mongo` represent?

## Scenario 5

DNS resolves `mongo`, but:

``` text
connect ECONNREFUSED
```

What does that tell you?

## Scenario 6

``` text
kubectl get endpoints mongo

mongo   <none>
```

What does that suggest?

------------------------------------------------------------------------

# 25. Interview-Level Questions

1.  Why is a Deployment preferred over manually creating Pods?
2.  Why does Kubernetes use Services instead of fixed Pod IPs?
3.  Explain Deployment vs ReplicaSet.
4.  How does a Service discover backend Pods?
5.  What happens when a Pod's IP changes?
6.  How does Kubernetes DNS enable `mongodb://mongo:27017/taskdb`?
7.  Why should configuration be separated from the Docker image?
8.  Why shouldn't database credentials be baked into a Docker image?
9.  What happens if a Deployment references a ConfigMap key that doesn't
    exist?
10. Practical difference between NodePort and ClusterIP?
11. Why did Kind need `extraPortMappings`?
12. What does kubelet do?
13. What role does containerd play?
14. If a Pod is Running but the application doesn't respond, what do you
    check?
15. Why are `kubectl describe` and Events useful when a container is
    stuck in `ContainerCreating`?

------------------------------------------------------------------------

# 26. Day 5 Completion Checklist

-   [x] Created Kind cluster
-   [x] Understood control-plane role
-   [x] Understood kubectl
-   [x] Understood kubectl context
-   [x] Created Deployment
-   [x] Created 3 Task API Pods
-   [x] Understood ReplicaSet
-   [x] Tested Pod self-healing
-   [x] Understood labels
-   [x] Understood selectors
-   [x] Created Task API Service
-   [x] Understood ClusterIP
-   [x] Implemented NodePort
-   [x] Configured Kind host port mapping
-   [x] Loaded local image into Kind
-   [x] Debugged ImagePullBackOff
-   [x] Created ConfigMap
-   [x] Injected ConfigMap values
-   [x] Created Kubernetes Secret
-   [x] Injected MONGO_URI
-   [x] Created MongoDB Deployment
-   [x] Created MongoDB Service
-   [x] Verified Kubernetes DNS
-   [x] Verified TCP connectivity to MongoDB
-   [x] Connected Task API to MongoDB
-   [x] Reached Task API through NodePort
-   [x] Verified `/health` from Windows

# Day 5 Status

**COMPLETE**

The Task Management application is now running as a small Kubernetes
system rather than simply as standalone Docker containers.
