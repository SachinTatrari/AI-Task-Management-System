const express = require('express');
const app = express();
const loggerMiddleware = require("./middleware/loggerMiddleware");
const taskRoutes = require("./routes/taskRoutes");

app.use(express.json());

app.get("/health", (req,res)=>{
    res.json({
        status:"OK",
    });
}
)
app.use(loggerMiddleware);
app.use("/api", taskRoutes);

app.use((req,res)=>{
    res.status(404).json({
        message:"Route not found",
    });
});
module.exports=app;