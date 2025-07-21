import express from "express";
import fs from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import YAML from "yaml";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const file = fs.readFileSync(path.resolve(__dirname, "./openapi.yaml"), "utf8");
const swaggerDocument = YAML.parse(file);

router.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default router;
