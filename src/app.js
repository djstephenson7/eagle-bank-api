import express from "express";
import accounts from "./routes/accounts.js";
import auth from "./routes/auth.js";
import users from "./routes/users.js";
import { connectToDatabase } from "./startup/connectToDatabase.js";

const app = express();
const port = 3000;

app.use(express.json());

app.use("/v1/accounts", accounts);
app.use("/v1/auth", auth);
app.use("/v1/users", users);

connectToDatabase();

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`Example app listening on port ${port}...`));
}

export { app };
