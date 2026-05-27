# Day 5 - Middleware and Request Pipeline

## Objective

Improve backend architecture by introducing middleware and understanding how requests flow through the Express application.

---

# Concepts Learned

## Middleware

Middleware is code that executes during the request-response lifecycle.

Request Flow:

Client
↓
Middleware
↓
Routes
↓
Controller
↓
Response

Middleware can:
- inspect requests
- modify requests
- log information
- validate data
- authenticate users
- handle errors

---

# Logging Middleware

Created custom logging middleware:

```js
const loggerMiddleware = (req, res, next) => {
   console.log(`${req.method} ${req.url}`);

   next();
};
```

---

# Important Understanding of next()

## next()

`next()` tells Express:
"Move request processing to the next middleware or route."

Without `next()`:
- request gets stuck
- response never reaches client
- application hangs

This is because middleware pipeline execution stops.

---

# Middleware Registration

Middleware added inside `app.js`:

```js
app.use(loggerMiddleware);
```

This applies middleware globally to all incoming requests.

---

# Middleware Execution Order

Express executes middleware in the order it is registered.

Example:

```js
app.use(loggerMiddleware);

app.use("/api", taskRoutes);
```

Request first enters logger middleware, then routes.

Order matters heavily in backend applications.

---

# app.use()

Learned that `app.use()` is used for:
- mounting middleware
- mounting routers

Examples:

```js
app.use(loggerMiddleware);

app.use("/api", taskRoutes);
```

---

# Global 404 Handler

Added fallback route handler:

```js
app.use((req, res) => {
   res.status(404).json({
      message: "Route not found"
   });
});
```

Purpose:
Handle invalid routes gracefully.

Example:
```plaintext
/random-route
```

returns:
```json
{
   "message": "Route not found"
}
```

---

# Request Lifecycle Understanding

Full Request Flow:

Client Request
↓
Express App
↓
Global Middleware
↓
Router Matching
↓
Controller Function
↓
Response Sent

---

# Important Backend Architecture Learnings

## Separation of Concerns

Application now has:
- routes layer
- controllers layer
- middleware layer

This improves:
- scalability
- readability
- maintainability

---

# Key Takeaways

- Middleware forms the backbone of Express applications.
- next() controls middleware pipeline continuation.
- Middleware execution order matters.
- app.use() is used for both middleware and route mounting.
- Express applications process requests in layers.