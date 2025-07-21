import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import openApi from "./docs/openApi.js";
import { errorHandler } from "./middleware/errorHandler.js";
import accounts from "./routes/accounts.js";
import auth from "./routes/auth.js";
import users from "./routes/users.js";
import { connectToDatabase } from "./startup/connectToDatabase.js";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  ipv6Subnet: 56 // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
});

const app = express();
const port = 3000;

app.use(express.json());
app.use(helmet());
app.use(limiter);

app.use("/v1/api-docs", openApi);
app.use("/v1/accounts", accounts);
app.use("/v1/auth", auth);
app.use("/v1/users", users);
app.use(errorHandler);

connectToDatabase();

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`Example app listening on port ${port}...`));
}

export { app };
