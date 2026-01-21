module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', 'build', 'node_modules'],
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      rules: {
        'no-undef': 'off',
      },
    },
    {
      files: ['backend/**/*.{ts,js}', 'tools/migrate/**/*.{ts,js}'],
      env: {
        node: true,
        browser: false,
      },
      rules: {
        'no-control-regex': 'off',
      },
    },
    {
      files: ['scripts/**/*.js'],
      env: {
        node: true,
        browser: false,
      },
    },
  ],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-unused-vars': 'off',
    'no-prototype-builtins': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  }
}
