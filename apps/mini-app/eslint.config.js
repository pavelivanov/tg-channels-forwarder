import baseConfig from '@aggregator/eslint-config';

export default [
  ...baseConfig,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
