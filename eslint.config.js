import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/', 'docs/'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: { ...prettier.rules, 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
  }
];
