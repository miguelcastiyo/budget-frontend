import js from "@eslint/js"
import tsParser from "@typescript-eslint/parser"

export default [
  {
    ignores: [".next/**", ".next-playwright/**", ".next-migration-playwright/**", "node_modules/**", "dist/**", "out/**"],
  },
  {
    ...js.configs.recommended,
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
]
