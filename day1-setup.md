# Learning why each line is required and why it is important

# app.js

const express = require('express');
# Express variable is holding/importing the express module from the node_modules.
# Node itself doesn't know, routing, APIs, middleware, HTTP handling. Express provides these features

const app = express();
# App variable calling the express function, when called it returns the app object which contains routing methods, middleware handling and server configuration ability. Its like express() creates the backend application. We are storing it is app to call various functions like: app.get(), app.post(), app.use(), app.listen()


app.use(express.json());
# This line adds middleware. Middleware is between request and response. Here, if the incoming request contains JSON, this function will parse the data automatically into JSON and present it to us

app.get("/health", (req,res)=>{
    res.json({
        status:"OK",
    });
}
)


module.exports=app;
# Exporting the app object so that other files can import it. 


# The entire purpose of:

# app.js: 

creates and configures your backend application.

It:

imports Express
creates app
enables JSON parsing
creates routes
exports configured app
#

# Server.js

require('dotenv').config();
# Here the command is to call the dotenv and configure function and configure the env variables.
# .config() runs dotenv configuration meaning: read the .env file now.
const app = require("./app");
# Here we are importing app which we created earlier in app.js

const PORT = process.env.PORT || 3000
# Here we are setting up the PORT variable with the port which we have set in the .env file. And if this doesn't happen then fall back to 3000 using || operator.

app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`)
})
# Using the listen function from the app object which we had imported above. After this line, server starts listening to the requests.

# server.js has ONLY ONE responsibility:

start the application.

It:

loads env vars
imports configured app
decides port
starts HTTP server
confirms startup

That’s it.