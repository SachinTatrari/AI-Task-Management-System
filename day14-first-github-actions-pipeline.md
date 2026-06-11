# Day 14 - Introduction to CI/CD and First GitHub Actions Pipeline

## Objective

Understand:

- Why CI/CD exists
- Continuous Integration
- Continuous Delivery
- Continuous Deployment
- Pipelines
- GitHub Actions
- Ephemeral runners
- Portability vs verification
- Reproducibility

This day marked the transition from local development to automated validation.

---

# Problem With Manual Processes

Current workflow:

Code Change
↓
Manual Testing
↓
npm install
↓
Run Application
↓
Push to GitHub

Everything depended on the developer.

Problems:

- Human error
- Forgotten steps
- Inconsistent environments
- Difficult scaling
- Lack of confidence

---

# Continuous Integration

Whenever code is pushed:

Git Push
↓
Pipeline Starts
↓
Install Dependencies
↓
Run Tests
↓
Success or Failure

Purpose:

Automatically validate code.

---

# Continuous Delivery

After successful validation:

Build Artifact
↓
Ready For Deployment

Human approval still exists.

---

# Continuous Deployment

Everything automatic:

Push Code
↓
Tests
↓
Build
↓
Deploy

No manual intervention.

---

# Delivery vs Deployment

Continuous Delivery:

Ready to deploy.

Continuous Deployment:

Automatically deployed.

---

# First GitHub Actions Workflow

File:

```plaintext
.github/workflows/ci.yml
```

Workflow:

```yaml
name: Node CI

on:
  push:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:

      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test
```

---

# Pipeline Flow

Git Push
↓
GitHub Detects Event
↓
Creates Ubuntu Runner
↓
Checkout Repository
↓
Setup Node
↓
Install Dependencies
↓
Run Tests
↓
Report Result
↓
Destroy Runner

---

# Initial Pipeline Failure

Error:

```plaintext
Missing script: "test"
```

Logs:

```plaintext
npm error Missing script: "test"
```

Pipeline failed during:

```yaml
run: npm test
```

---

# Investigation

Workflow syntax was correct.

Node installation succeeded.

Dependencies installed successfully.

Therefore issue was not:

- GitHub Actions
- Ubuntu runner
- YAML

Issue was inside application configuration.

---

# Root Cause

package.json contained:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon -L src/server.js"
}
```

Missing:

```json
"test"
```

script.

---

# Solution

Added:

```json
"test": "echo \"No tests yet\""
```

Now:

```bash
npm test
```

returns:

```plaintext
No tests yet
```

with exit code:

```plaintext
0
```

Pipeline succeeds.

---

# Important Lesson

Pipeline failure does not always mean CI is broken.

It may indicate:

Application problem.

This was a software issue, not a CI issue.

---

# First Successful Pipeline

Event
↓
Job
↓
Checkout
↓
Setup Node
↓
npm install
↓
npm test
↓
Success

---

# Ephemeral Runners

GitHub creates:

Temporary Ubuntu VM

for every run.

Properties:

- fresh machine
- no previous files
- no cache
- no node_modules
- stateless

After completion:

Runner is destroyed.

---

# Initial Confusion

Question:

If the runner gets destroyed, what happened to the build?

---

# Answer

Nothing is preserved.

Flow:

VM Created
↓
Code Downloaded
↓
npm install
↓
Tests Executed
↓
Success Reported
↓
VM Destroyed

Everything disappears.

---

# Purpose Of CI

Not:

Preserve artifacts.

But:

Verify project health.

Question being answered:

Can this project recreate itself from scratch?

---

# Important Principle

Ephemeral runners prevent hidden dependencies.

Without fresh machines:

Old files
↓
Pipeline passes incorrectly

Fresh runners guarantee:

No leftovers.

---

# Another Important Question

Why does this prove portability?

After all, anyone could clone the repository and run it manually.

---

# Clarification

CI does NOT magically make applications portable.

CI verifies portability.

---

# Before CI

Works on:

Sachin's machine.

Confidence level:

Low.

---

# After CI

Works on:

- Windows laptop
- Fresh Ubuntu machine

Confidence level:

Much higher.

---

# What CI Actually Proves

Starting from zero,

a completely fresh environment can reconstruct the project successfully.

---

# OS Independence Question

Question:

Did CI make the application OS independent?

Answer:

No.

CI only demonstrated that:

Windows
and
Ubuntu

both successfully execute the project.

---

# Example Of OS Dependency

Code:

```javascript
fs.readFileSync("C:\\temp\\file.txt");
```

Might work:

Windows

but fail:

Ubuntu

CI would catch such issues.

---

# Portability Is A Spectrum

Level 1

Works on my machine.

Weak evidence.

---

Level 2

Works on another machine.

Better evidence.

---

Level 3

Works on fresh GitHub runner.

Stronger evidence.

---

Level 4

Runs inside Docker image.

High portability.

---

Level 5

Runs on Kubernetes.

Production-grade portability.

---

# Build Question

Question:

Why did GitHub build the application?

---

# Answer

For Node applications:

There may not even be a build step.

Current workflow simply performed:

```bash
npm install
npm test
```

No Docker image or artifact was created.

Only validation occurred.

---

# Reproducibility

Git:

Reproduces source code.

---

package.json:

Reproduces dependencies.

---

Docker:

Reproduces runtime environment.

---

GitHub Actions:

Verifies that fresh environments can reproduce the project.

---

Kubernetes:

Reproduces entire systems.

---

# Exam Hall Analogy

Project:

Student.

Runner:

Exam hall.

Pipeline:

Exam.

After exam:

Hall destroyed.

Purpose was never to preserve the hall.

Purpose was to determine:

Did the student pass?

---

# Infrastructure Philosophy

Nothing should be special.

Nothing should be irreplaceable.

Everything should be reproducible.

This philosophy appears throughout:

- Docker
- CI/CD
- Kubernetes
- Cloud Computing
- Infrastructure Engineering

---

# Major Learnings

- CI automatically validates code.
- CI and CD are different concepts.
- Pipeline failures often reveal software problems.
- GitHub runners are temporary and stateless.
- CI verifies reproducibility.
- Portability is a spectrum.
- Fresh environments increase confidence.
- Destroying runners is intentional.
- Reproducibility is a core infrastructure principle.

---

# Biggest Takeaway

CI does not create portability.

CI repeatedly proves that the project can rebuild itself successfully from nothing.

Modern systems are designed around disposable infrastructure and reproducible environments.