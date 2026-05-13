const express = require('express')

const router =  express.Router();

const tasks = [];

router.get("/tasks", (req, res)=>{
    res.json(tasks);
});

router.post("/tasks", (req,res)=>{
const task = req.body;
tasks.push(task);

res.status(201).json({
    message: "Task Created",
    task,
});
});

module.exports = router;
