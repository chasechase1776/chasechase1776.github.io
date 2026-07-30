import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      "**/.next/**",
      "**/.next-*/**",
      "node_modules/**",
      "out/**",
      "dist/**",
      "build/**",
      "coverage/**",
      ".vercel/**",
      ".ontoly/**",
      "ontoly-output/**",
      "records/**",
      "site/**",
      "next-env.d.ts"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript")
];

export default eslintConfig;
