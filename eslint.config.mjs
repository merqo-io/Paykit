import next from "eslint-config-next";
import sonarjs from "eslint-plugin-sonarjs";
import { merqoEslintPreset } from "@merqo/ui/eslint";

const tsPlugin = next.find((c) => c.plugins?.["@typescript-eslint"]).plugins[
  "@typescript-eslint"
];

const eslintConfig = [
  ...next,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "sonarjs/no-unused-vars": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "supabase/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      ".stryker-tmp/**",
      "reports/**",
      // Nested git worktrees (.claude/worktrees/<name>/) are separate
      // checkouts with their own node_modules/.next/etc — the globs above
      // are root-anchored (gitignore semantics) and don't reach into them.
      "**/.claude/worktrees/**",
      // Harness re-sync merge-base snapshot: a byte-for-byte mirror of the
      // seeded hook scripts. Linting it too would double every finding and
      // risks eslint --fix rewriting it out of sync with harness.json's
      // recorded hash — same reasoning as the pre-commit format-lint
      // exclusion in .husky/lib/pre-commit.sh.
      ".claude/.harness-base/**",
    ],
  },
  sonarjs.configs.recommended,
  {
    // Generated shadcn primitives: not this repo's code to restructure.
    files: ["src/components/ui/**"],
    rules: { "sonarjs/prefer-read-only-props": "off" },
  },
  ...merqoEslintPreset({
    sonarjsPlugin: sonarjs.configs.recommended.plugins.sonarjs,
    tsPlugin,
  }),
  {
    // Over the size limit until Task K5 (split long files) shrinks them.
    files: ["src/lib/types.ts"],
    rules: { "max-lines": "off" },
  },
];

export default eslintConfig;
