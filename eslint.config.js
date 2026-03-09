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
