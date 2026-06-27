import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "date-fns-tz",
              message: "date-fns-tz may only be imported from lib/date/",
            },
          ],
          patterns: [
            {
              group: ["date-fns-tz/*"],
              message: "date-fns-tz may only be imported from lib/date/",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/date/**/*.ts", "lib/date/**/*.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
