import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Vendored shadcn/ui components export their cva variants and hooks next
    // to the components (upstream pattern); keep them as generated.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // The language provider and its hook belong in one file.
    files: ["src/lib/i18n/index.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Legacy loose typing of database rows, joins and caught errors. Typing these properly
    // (and regenerating src/integrations/supabase/types.ts) is a separate change; the rule
    // stays on for every other file, so new code cannot add more `any`.
    files: [
      "src/components/ExercisesDialog.tsx",
      "src/components/LessonPanel.tsx",
      "src/components/PodcastPlayer.tsx",
      "src/lib/exams.functions.ts",
      "src/lib/vocabulary.functions.ts",
      "src/routes/_authenticated/exam.new.tsx",
      "src/routes/auth.tsx",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  eslintPluginPrettier,
);
