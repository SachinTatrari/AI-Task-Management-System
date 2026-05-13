const express = require('express');
const app = express();
const taskRoutes = require("./routes/taskRoutes");

app.use(express.json());

app.get("/health", (req,res)=>{
    res.json({
        status:"OK",
    });
}
)

app.use("/api", taskRoutes);


module.exports=app;