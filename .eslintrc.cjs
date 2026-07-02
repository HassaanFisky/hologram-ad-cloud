/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  ignorePatterns: [
    'dist/',
    '.next/',
    'node_modules/',
    'coverage/',
    'build/',
    'next-env.d.ts'
  ],
  overrides: [
    {
      files: [
        'apps/web/**/*.{ts,tsx}',
        'apps/admin/**/*.{ts,tsx}',
        'apps/docs/**/*.{ts,tsx}'
      ],
      extends: ['next/core-web-vitals']
    },
    {
      files: ['*.js', '*.cjs'],
      parserOptions: {
        sourceType: 'script'
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
};
