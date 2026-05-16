const express = require('express')

const router =  express.Router();

const {getAllTasks,
    getTaskById,
    createTask,
    updateTaskById,
    deleteTaskById} = require("../controllers/taskController");

router.get("/tasks",getAllTasks);

router.get("/tasks/:id",getTaskById);

router.post("/tasks",createTask);

router.put("/tasks/:id",updateTaskById);

router.delete("/tasks/:id",deleteTaskById);

module.exports = router;
