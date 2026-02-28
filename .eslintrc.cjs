module.exports = {
  root: true,
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    'client/tsconfig.tsbuildinfo',
    'server/dev-server.mjs',
    'server/dev-server.cjs'
  ],
  overrides: [
    {
      files: ['client/src/**/*.{ts,tsx}', 'server/src/**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/strict'
      ],
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports'
          }
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_|^Feature$'
          }
        ]
      }
    },
    {
      files: ['client/src/**/*.{ts,tsx}'],
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      plugins: ['react-hooks', 'react-refresh'],
      extends: ['plugin:react-hooks/recommended'],
      rules: {
        'react-hooks/exhaustive-deps': 'error',
        'react-refresh/only-export-components': [
          'error',
          {
            allowConstantExport: true
          }
        ]
      }
    },
    {
      files: ['client/src/components/quote/QuoteMap.tsx'],
      rules: {
        'react-hooks/exhaustive-deps': 'off'
      }
    }
  ]
};
