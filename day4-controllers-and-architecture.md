# Day 4 - Controllers and Backend Architecture

## Objective

Refactor backend architecture by separating route definitions from request handling logic.

---

# Concepts Learned

## Separation of Concerns

Backend applications become easier to maintain when responsibilities are separated.

### Routes Layer
Responsible for:
- endpoint definitions
- URL mapping
- HTTP methods

Example:
```js
router.get("/tasks", getAllTasks);
```

---

### Controllers Layer
Responsible for:
- handling requests
- processing request data
- sending responses

Example:
```js
const getAllTasks = (req, res) => {
   res.json(tasks);
};
```

---

# New Project Structure

```plaintext
src/
│
├── routes/
│   └── taskRoutes.js
│
├── controllers/
│   └── taskController.js
│
├── app.js
└── server.js
```

---

# Important Backend Understanding

## app.js
Configures application and mounts routes.

---

## taskRoutes.js
Maps endpoints to controller functions.

---

## taskController.js
Contains request handling logic.

---

# Important JavaScript/Express Learnings

## req and res Must Exist in Controller Functions

Problem faced:

While moving functions from routes to controllers, `req` and `res` parameters were forgotten.

Incorrect:
```js
const getAllTasks = () => {
   res.json(tasks);
};
```

Error:
```plaintext
ReferenceError: res is not defined
```

---

## Root Cause

`res` and `req` are not global variables.

Express injects them into route handler functions automatically.

So controller functions must explicitly receive them as parameters.

Correct:
```js
const getAllTasks = (req, res) => {
   res.json(tasks);
};
```

---

# Request Flow Understanding

Client Request
↓
Express App
↓
Route
↓
Controller Function
↓
Response Sent Back

---

# Why This Refactor Matters

Benefits:
- cleaner routes
- scalable architecture
- easier maintenance
- better readability
- professional backend structure

---

# Key Takeaway

As application complexity increases, architecture should evolve gradually.

Controllers help separate:
- routing logic
from
- request handling logic