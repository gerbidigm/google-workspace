/**
 * @license
 * Copyright 2026 Charlie Voiselle
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint overrides for gerbidigm custom tools.
 * Imported and spread into the root eslint.config.js via a patch.
 * See gerbidigm/patches/eslint.config.js.patch for the required change.
 */

const headers = require('eslint-plugin-headers');

module.exports = [
  {
    // Gerbidigm custom tools are copyright Charlie Voiselle, not Google LLC.
    files: ['workspace-server/src/gerbidigm/**/*.{ts,js}'],
    plugins: { headers },
    rules: {
      'headers/header-format': [
        'error',
        {
          source: 'string',
          content: [
            '@license',
            'Copyright (year) Charlie Voiselle',
            'SPDX-License-Identifier: Apache-2.0',
          ].join('\n'),
          patterns: {
            year: {
              pattern: '202[5-6]',
              defaultValue: '2026',
            },
          },
        },
      ],
    },
  },
];
