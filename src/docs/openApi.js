import express from "express";
import fs from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import YAML from "yaml";

const router = express.Router();
const filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const dirname = path.dirname(filename); // get the name of the directory

const file = fs.readFileSync(path.resolve(dirname, "./openapi.yaml"), "utf8");
const swaggerDocument = YAML.parse(file);

router.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default router;
