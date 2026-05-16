const express = require('express')

const router =  express.Router();

const tasks = [];

let currentTaskId = 1;

router.get("/tasks", (req, res)=>{
    
    if(tasks.length==0){
        return res.status(404).json({
            message: "Task Bucket is empty",

        });
    }
    
    res.json({
        tasks
    });
});

router.get("/tasks/:id", (req, res)=>{
    const taskID= parseInt(req.params.id);
    console.log(taskID);

    const task = tasks.find((task)=>task.id===taskID);
    console.log(task)
    if(!task){
        return res.status(404).json({
            message: "Task not found",

        });
    }
    
    res.json(task);
});



router.post("/tasks", (req,res)=>{
const { title } = req.body;

if(!title){

    return res.status(400).json({
        message: "Title is required"
    });
}
const newTask = {
    id: currentTaskId++,
    title
};
tasks.push(newTask);

res.status(201).json({
    message: "Task Created",
    task: newTask,
});

});

router.put("/tasks/:id", (req,res)=>{
    const taskId =  parseInt(req.params.id);
    const task = tasks.find((task)=> task.id===taskId);
    if(!task){
        return res.status(404).json({
            message: "Task Not Found",   
        });
    }

    const {title} = req.body;
    if(!title){
        return res.status(400).json({
            message: "Title is required",
        });
    }
    task.title=title;
    res.json({
        message:"Task Updated",
        task,
    });
});

router.delete("/tasks/:id", (req,res)=>{
    const taskId= parseInt(req.params.id);
    const taskIndex = tasks.findIndex((task)=>task.id===taskId)
    if(taskIndex===-1){
        res.status(404).json({
            message: "Task Not Found",
        });
    }
    tasks.splice(taskIndex,1);
    res.json({
        message: "Task Deleted",
    });
});

module.exports = router;
