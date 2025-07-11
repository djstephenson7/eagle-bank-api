import express from "express";
import { connectToDatabase } from "./startup/connectToDatabase.js";
import users from "./routes/users.js";
import auth from "./routes/auth.js";

const app = express();
const port = 3000;

app.use(express.json());

app.use("/v1/users", users);
app.use("/v1/auth", auth);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

connectToDatabase();

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`Example app listening on port ${port}...`));
}

export { app };
