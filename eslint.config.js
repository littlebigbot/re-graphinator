import js from '@eslint/js'
import ts from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default ts.config(
  { ignores: ['dist/**', 'node_modules/**'] },

  js.configs.recommended,
  ...ts.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  prettier,

  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      // ── General ─────────────────────────────────────────────────────────────
      'curly': ['error', 'all'],
      // Disallow single-line block bodies: if (x) { return y; } must be multi-line.
      // Placed after eslint-config-prettier so it overrides the 'off' it sets.
      // 1tbs is compatible with Prettier; arrow function concise forms are unaffected.
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
      // Require descriptive variable names going forward. Exceptions:
      //   i/j/k  — loop indices
      //   x/y/z  — coordinates or math
      //   a/b    — sort comparators: arr.sort((a, b) => a - b)
      //   n      — generic count / math scalar
      //   _      — intentionally unused (paired with no-unused-vars pattern)
      // Properties are excluded (object keys like { id: x } are fine short).
      'id-length': ['warn', {
        min: 2,
        exceptions: ['_', 'i', 'j', 'k', 'x', 'y', 'z', 'a', 'b', 'n', 'N', 'e'],
        properties: 'never',
      }],

      // ── TypeScript ───────────────────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      }],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // ── Vue best practices ───────────────────────────────────────────────────
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/define-macros-order': ['error', {
        order: ['defineProps', 'defineEmits', 'defineExpose'],
      }],
      'vue/no-unused-vars': 'error',
      'vue/prefer-import-from-vue': 'error',
      'vue/no-v-html': 'error',
      // TypeScript already documents prop requirements — default values aren't needed
      'vue/require-default-prop': 'off',
    },
  },
)
