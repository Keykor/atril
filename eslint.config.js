import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.serviceworker } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Arquitectura: solo core/ toca IndexedDB y pdf.js. Las pantallas leen con
    // core/db/queries.ts (dentro de useLiveQuery) y escriben con core/db/repos.ts.
    files: ['src/app/**', 'src/features/**', 'src/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'dexie', message: 'Solo core/ usa Dexie.' },
            { name: 'pdfjs-dist', message: 'Solo core/pdf usa pdf.js.' },
          ],
          patterns: [
            {
              regex: 'core/db/db$',
              message:
                'Las pantallas no importan la base: leé con core/db/queries y escribí con core/db/repos.',
            },
            {
              regex: '(^|/)features/',
              message: 'Una feature no importa de otra feature: componé en src/app/.',
            },
          ],
        },
      ],
    },
  },
  {
    // src/app/ compone features: ahí sí se las importa.
    files: ['src/app/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'dexie', message: 'Solo core/ usa Dexie.' },
            { name: 'pdfjs-dist', message: 'Solo core/pdf usa pdf.js.' },
          ],
          patterns: [
            {
              regex: 'core/db/db$',
              message:
                'Las pantallas no importan la base: leé con core/db/queries y escribí con core/db/repos.',
            },
          ],
        },
      ],
    },
  },
  {
    // core/ no depende de la interfaz.
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '(^|/)(features|app|ui)/', message: 'core/ no importa de la UI.' }] },
      ],
    },
  },
);
