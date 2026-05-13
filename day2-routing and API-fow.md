# Day 2 - Routing and API Flow

## What I Learned

### Router
Router helps organize endpoints into separate files.

### app.use("/api", taskRoutes)
Mounts all task routes under /api. 

### Request Lifecycle
Client → Express App → Middleware → Router → Handler → Response

### req.body
Contains parsed JSON request body.

### GET vs POST
GET fetches data.
POST sends/creates data.