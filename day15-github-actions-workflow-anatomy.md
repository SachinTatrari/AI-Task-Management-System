# Day 15 - GitHub Actions Workflow Anatomy

## Objective

Understand the fundamental building blocks of GitHub Actions instead of memorizing YAML syntax.

Topics covered:

- Workflow
- Events
- Jobs
- Steps
- Actions
- Runners
- uses vs run
- Internal execution flow
- Why runners are ephemeral

This lesson focused on understanding how GitHub Actions actually executes a workflow behind the scenes.

---

# The Big Picture

Our current workflow:

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

At first glance it looks like a YAML file.

In reality it is an automation process.

---

# GitHub Company Analogy

Imagine GitHub as a company.

Developer:

"I pushed new code."

GitHub:

"I'll assign a worker to verify it."

That worker is called a Runner.

The runner follows the instruction manual (Workflow) and performs every task one by one.

---

# Workflow

Definition:

A workflow is an automation process that defines what should happen when a specific event occurs.

Simple understanding:

Instruction Manual

Example:

Restaurant SOP

Customer enters
↓

Seat customer

↓

Take order

↓

Cook food

↓

Serve food

Similarly:

Git Push

↓

Checkout Code

↓

Install Node

↓

Install Dependencies

↓

Run Tests

---

# Event

Workflow starts only when an event occurs.

Current event:

```yaml
on:
  push:
```

Meaning:

Whenever code is pushed,

start this workflow.

---

# Examples of Events

Push

```yaml
on:
  push:
```

Pull Request

```yaml
on:
  pull_request:
```

Scheduled Execution

```yaml
on:
  schedule:
```

Manual Trigger

```yaml
on:
  workflow_dispatch:
```

---

# Analogy

Event is like pressing a doorbell.

Nothing happens until someone presses it.

---

# Job

Definition:

A job is a collection of related steps that run on the same runner.

Current workflow:

```yaml
jobs:

  build:
```

Important realization:

"build" is NOT a keyword.

It is only a job name.

This would also work:

```yaml
jobs:
  sachin:
```

---

# Why Multiple Jobs?

Example:

```yaml
jobs:

  build:

  test:

  deploy:
```

Jobs can:

- run independently
- run sequentially
- run in parallel
- run on different operating systems

Example:

Build → Ubuntu

Tests → Windows

Deploy → Ubuntu

---

# Runner

Current workflow:

```yaml
runs-on: ubuntu-latest
```

Meaning:

GitHub creates a fresh Ubuntu virtual machine.

The entire job executes on this runner.

After completion,

runner is destroyed.

---

# Why Are Runners Ephemeral?

Question:

Why destroy the runner after every execution?

Answer:

To ensure every workflow starts in a completely clean environment.

Benefits:

- No leftover files
- No hidden dependencies
- No cached mistakes
- Reproducible builds

---

# Step

Definition:

A step is a single unit of work inside a job.

Current steps:

Checkout Code

↓

Setup Node

↓

Install Dependencies

↓

Run Tests

Every job consists of one or more steps.

---

# Important Distinction

Workflow

↓

Job

↓

Step

A workflow contains jobs.

A job contains steps.

---

# GitHub Actions

Current workflow uses:

```yaml
uses: actions/checkout@v4
```

Question:

Why didn't we simply write:

```yaml
run: git clone ...
```

Answer:

Because someone has already solved this problem.

GitHub provides reusable automation called Actions.

---

# What Is An Action?

An Action is a reusable automation component created by GitHub or the community.

Think of it exactly like using a library in programming.

Example:

Node.js:

```javascript
const express = require("express");
```

Instead of creating an HTTP server from scratch.

Similarly:

```yaml
uses: actions/checkout@v4
```

Instead of writing Git clone logic manually.

---

# uses

Definition:

Executes an existing GitHub Action.

Purpose:

Reuse automation instead of writing it again.

Examples:

```yaml
uses: actions/checkout@v4
```

```yaml
uses: actions/setup-node@v4
```

---

# run

Definition:

Executes shell commands directly on the runner.

Examples:

```yaml
run: npm install
```

```yaml
run: npm test
```

GitHub literally opens a terminal on the runner and executes these commands.

---

# uses vs run

uses

- Executes reusable GitHub Actions.
- Someone else has already implemented the automation.
- Used for common tasks.

Examples:

- Checkout repository
- Setup Node
- Login to Docker
- Upload artifacts

---

run

- Executes shell commands.
- Commands are written by us.
- Runs directly on the runner.

Examples:

- npm install
- npm test
- docker build
- ls
- pwd

---

# Internal Execution Flow

When developer pushes code:

Git Push

↓

GitHub detects event

↓

Reads workflow

↓

Creates Ubuntu Runner

↓

Executes:

Step 1

Checkout Action

↓

Step 2

Setup Node Action

↓

Step 3

Run npm install

↓

Step 4

Run npm test

↓

Collect logs

↓

Report success or failure

↓

Destroy runner

---

# Important Observation

GitHub behaves like a small operating system.

It:

- detects events
- provisions machines
- schedules work
- executes instructions
- collects logs
- destroys temporary infrastructure

---

# Interview-Level Definitions

Workflow

An automation process that defines what should happen when a specific event occurs.

---

Event

A trigger that starts workflow execution.

Examples:

- push
- pull request
- schedule

---

Job

A collection of related steps executed on the same runner.

---

Step

A single unit of work inside a job.

---

Action

A reusable automation component created by GitHub or the community.

---

Runner

A temporary machine that executes jobs.

---

uses

Runs reusable GitHub Actions.

---

run

Executes shell commands directly on the runner.

---

# Mental Model

Workflow

↓

Event

↓

Job

↓

Runner

↓

Steps

↓

Action (uses)

or

↓

Shell Commands (run)

---

# Key Learnings

- Workflow is the complete automation process.
- Events trigger workflows.
- Jobs group related work.
- Steps perform individual tasks.
- Actions are reusable automation components.
- uses executes Actions.
- run executes shell commands.
- Runners are temporary virtual machines.
- GitHub provisions and destroys infrastructure automatically.
- Fresh runners ensure reproducibility.

---

# Biggest Takeaway

GitHub Actions is not just a YAML file.

It is an automation engine that responds to events, creates temporary infrastructure, executes workflows, and destroys that infrastructure after completion.

Understanding this execution model is far more valuable than memorizing the syntax.