require('dotenv').config();

const app = require("./app");

const PORT = process.env.PORT || 3000

const connectDB = require("./config/db");

connectDB();

app.listen(PORT, ()=>{
    console.log(`Server started running on port ${PORT}`)
    console.log("RESTART TEST 123");
})



