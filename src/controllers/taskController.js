
const tasks = [];

let currentTaskId = 1;

// Method to get all tasks
const getAllTasks = (req, res)=>{
    if(tasks.length==0){
        return res.status(404).json({
            message: "Task Bucket is empty",

        });
    }
    
    res.json({
        tasks
    });
};

// Method to get task by ID
const getTaskById = (req,res)=>{
    const taskID= parseInt(req.params.id); 

    const task = tasks.find((task)=>task.id===taskID);
    
    if(!task){
        return res.status(404).json({
            message: "Task not found",

        });
    }
    
    res.json(task);
};

// Method to create a task
const createTask = (req,res)=>{
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
};

// Method to update a task by ID
const updateTaskById = (req,res)=>{
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
};

//Method to delete a task by ID
const deleteTaskById = (req,res)=>{
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
};

module.exports = {
    getAllTasks,
    getTaskById,
    createTask,
    updateTaskById,
    deleteTaskById
};