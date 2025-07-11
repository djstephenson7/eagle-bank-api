import express from "express";
import { connectToDatabase } from "./startup/connectToDatabase.js";
import usersRouter from "./routes/users.js";

const app = express();
const port = 3000;

app.use(express.json());

app.use("/v1/users", usersRouter);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

connectToDatabase();

const server = app.listen(port, () => console.log(`Example app listening on port ${port}...`));

export default server;
