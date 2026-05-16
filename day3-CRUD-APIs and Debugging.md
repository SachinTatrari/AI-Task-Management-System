# Day 3 - CRUD APIs and Debugging

## Concepts Learned

### CRUD Operations
- Create → POST
- Read → GET
- Update → PUT
- Delete → DELETE

### Dynamic Routes
Used route parameters like:
`/tasks/:id`

Example:
`/tasks/1`

### req.params
Used to extract dynamic values from URL.

Example:
req.params.id

### parseInt()
Needed because URL params come as strings.

### REST Status Codes
- 200 → Success
- 201 → Resource Created
- 400 → Bad Request
- 404 → Resource Not Found

---

## Important JavaScript Learnings

### Arrow Function Return Issue

Problem:
find() was returning undefined.

Incorrect:
```js
tasks.find((task)=>{
   task.id === taskID
})

Correct:
tasks.find((task)=>{
 return  task.id === taskID
})
Or:
tasks.find((task)=>task.id === taskID)