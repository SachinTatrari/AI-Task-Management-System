# Day 19 - Advanced BuildKit Caching & Registry Internals

## Objective

Today's goal was to understand how BuildKit makes builds fast even on machines that have never built the project before.

By the end of this session, I understood:

- Why local Docker cache is insufficient for CI/CD.
- What remote cache is.
- Difference between `--cache-from` and `--cache-to`.
- How BuildKit identifies reusable layers.
- How registries internally store cache.
- Why only changed layers are uploaded.
- How metadata, blobs, manifests and fingerprints work together.

---

# Why Local Cache is Not Enough

Initially I learned that Docker stores build cache inside the local Docker Engine.

```
Developer Laptop

Docker Engine

├── Images
├── Containers
├── Volumes
├── Networks
└── Build Cache
```

This works perfectly on my own machine because every build can reuse the cache created by previous builds.

However, this approach breaks in CI/CD.

Example:

```
GitHub Actions

Workflow #1
↓

Fresh VM

↓

Build

↓

VM Destroyed
```

Next build:

```
Workflow #2

↓

New VM

↓

No Docker Cache Exists
```

Every workflow starts with a brand-new Docker Engine.

Therefore, local cache is lost after every build.

---

# Remote Cache

BuildKit solves this problem by allowing cache to be stored outside the local machine.

Instead of:

```
Laptop
↓

Local Docker Cache
```

we can have:

```
Developer
      │
      ▼

Registry / Cloud Storage

      ▲
      │

GitHub Runner
```

Now every machine can reuse previously built layers.

Remote cache can be stored in:

- Container Registry
- GitHub Actions Cache
- Amazon S3
- Azure Blob Storage
- Local Directory
- Other supported cache backends

---

# Docker Image vs Build Cache

Initially I assumed cache and image were the same thing.

They are not.

Docker Image:

Purpose:
Run containers.

Build Cache:

Purpose:
Reuse previous build results.

A registry may store both images and BuildKit cache.

---

# Exporting Cache

BuildKit uploads cache using:

```bash
--cache-to
```

Think of it as:

```
Local Build

↓

Export Cache

↓

Remote Registry
```

Future builds can reuse this cache.

---

# Importing Cache

Future builds use:

```bash
--cache-from
```

Conceptually:

```
Start Build

↓

Download Cache Metadata

↓

Compare Cache Keys

↓

Reuse Existing Layers
```

Important:

BuildKit usually downloads metadata first.

It does NOT immediately download every cached layer.

---

# Why Metadata is Downloaded First

Imagine downloading 30GB of cache for every build.

That would defeat the purpose.

Instead BuildKit first downloads the cache manifest (metadata).

This manifest tells BuildKit:

```
Fingerprint A
↓

Blob X

Fingerprint B
↓

Blob Y
```

Only required blobs are downloaded later.

This is similar to browsing a Netflix catalogue before streaming a movie.

---

# Fingerprints and Hashes

Every layer has a unique identity generated from:

- Dockerfile instruction
- Input files
- Relevant metadata

Conceptually:

```
Instruction
+
Input Files
+
Metadata

↓

Hash Function

↓

Fingerprint (Cache Key)
```

BuildKit computes fingerprints locally.

Then it searches the configured cache backend for matching fingerprints.

---

# Why Doesn't BuildKit Search the Entire Docker Hub?

One important question I had was:

If fingerprints are content-based and deterministic, why doesn't BuildKit search the whole Docker Hub for identical layers?

Answer:

Because BuildKit only searches the cache backend that I explicitly configure.

Example:

```
Configured Backend

company/cache
```

NOT

```
Entire Docker Hub
```

Reasons:

- Privacy
- Security
- Performance
- Ownership

Identical fingerprints can exist in different registries, but BuildKit cannot access caches that were never configured.

---

# Cache Exporters and Importers

Export:

```
Build

↓

Upload Cache
```

Import:

```
Build Starts

↓

Read Remote Cache

↓

Reuse Matching Layers
```

Every successful build improves the remote cache for future builds.

---

# Registry Internals

Initially I imagined a registry storing something like:

```
Image.zip
```

This is incorrect.

A registry stores:

```
Manifest

↓

Blob References

↓

Blob Storage
```

The same idea applies to BuildKit cache.

Instead of an Image Manifest, BuildKit stores a Cache Manifest.

---

# What is a Blob?

Blob stands for:

**Binary Large Object**

A blob usually represents compressed filesystem changes created by one Docker layer.

Example:

```
Layer

↓

Blob

↓

Stored in Registry
```

The registry stores blobs separately from metadata.

---

# Cache Manifest

The cache manifest acts like an index.

It stores relationships such as:

```
Fingerprint

↓

Blob Digest

↓

Dependencies
```

It does NOT contain the filesystem itself.

Instead it points to blobs that already exist.

---

# Metadata

Metadata is like a database index.

Instead of searching every blob,

BuildKit asks:

```
Does Fingerprint XYZ exist?
```

Registry:

```
Metadata

↓

Fingerprint

↓

Blob Digest
```

If found:

Reuse blob.

Otherwise:

Upload new blob.

---

# Why Only Changed Layers Are Uploaded

Suppose an image has ten layers.

Only the last layer changes because:

```
server.js
```

was modified.

BuildKit computes fingerprints for every layer.

```
Layer 1

↓

Fingerprint A
```

Registry already has it.

Result:

No upload.

Same for layers 2–9.

Last layer:

```
Fingerprint J'
```

Registry cannot find it.

Therefore:

Only Blob J is uploaded.

Finally the cache manifest is updated.

This dramatically reduces upload time.

---

# Complete Build Flow

```
Build Starts

↓

Compute Fingerprints

↓

Download Cache Manifest

↓

Compare Cache Keys

↓

Cache Hit?
       │
 ┌─────┴─────┐
 │           │
Yes          No
 │           │
Reuse     Build Layer
 │           │
 └─────┬─────┘
       │
       ▼

Build Completed

↓

Upload New Blobs

↓

Update Cache Manifest
```

---

# Real-Life Analogy

Imagine a library.

Metadata:

Library catalogue.

Blobs:

Actual books.

When someone asks for a book,

the librarian first searches the catalogue,

not every shelf.

Similarly,

BuildKit first checks metadata before touching blobs.

---

# Key Learnings

- Docker cache is local to a Docker Engine.
- GitHub runners lose cache because runners are ephemeral.
- Remote cache allows multiple machines to reuse builds.
- `--cache-to` exports cache.
- `--cache-from` imports cache.
- BuildKit compares fingerprints instead of files.
- Fingerprints are derived from Dockerfile instructions and inputs.
- Registries store blobs separately from metadata.
- Cache manifests map fingerprints to blobs.
- Metadata acts like a database index.
- Only changed layers are uploaded.
- BuildKit never searches the entire Docker Hub for cache.
- BuildKit only searches configured cache backends.

---

# Interview Questions Covered

### Why does GitHub Actions lose Docker cache after every build?

Because every workflow runs on a fresh ephemeral VM with a new Docker Engine. Local cache does not persist between workflows.

---

### What is the difference between `--cache-to` and `--cache-from`?

`--cache-to` exports BuildKit cache to a remote backend.

`--cache-from` imports previously exported cache to speed up future builds.

---

### Why doesn't BuildKit search everyone's Docker Hub cache?

Because cache lookup is restricted to configured cache backends. This protects privacy, security, and performance.

---

### Why are only changed layers uploaded?

BuildKit compares fingerprints with registry metadata. Existing blobs are reused, and only layers with new fingerprints are uploaded.

---

### What is the purpose of a cache manifest?

A cache manifest maps cache keys (fingerprints) to blob digests and dependency information, allowing BuildKit to quickly locate reusable layers without scanning every blob.