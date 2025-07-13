import js from "@eslint/js";
import eslintPluginJest from "eslint-plugin-jest";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"] },
  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.node } },

  {
    files: ["**/*.test.js", "**/__mocks__/**/*.js"],
    plugins: { jest: eslintPluginJest },
    languageOptions: {
      globals: { ...eslintPluginJest.environments.globals.globals }
    }
  }
]);
