import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Arquitectura (ver docs/arquitectura.md): solo core/ toca IndexedDB y pdf.js. Las pantallas
// leen con core/db/queries.ts (dentro de useLiveQuery) y escriben con core/db/repos.ts.
// Los patrones se comparan contra el texto del import, así que cubren también subrutas
// (`pdfjs-dist/legacy/...`, `dexie/...`).
const noCoreInternals = [
  { regex: '^dexie(/|$)', message: 'Solo core/ usa Dexie.' },
  { regex: '^pdfjs-dist(/|$)', message: 'Solo core/pdf usa pdf.js.' },
  {
    regex: 'core/db/db$',
    message:
      'Las pantallas no importan la base: leé con core/db/queries y escribí con core/db/repos.',
  },
];
// Desde src/features/<feature>/, `../otra/...` es otra feature (`../../core/...` sigue valiendo).
const noOtherFeature = {
  regex: '^\\.\\./[^./]',
  message: 'Una feature no importa de otra feature: componé en src/app/.',
};

const restrict = (...patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });

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
  // src/app/ compone features, así que puede importarlas.
  { files: ['src/app/**', 'src/ui/**'], rules: restrict(...noCoreInternals) },
  { files: ['src/features/**'], rules: restrict(...noCoreInternals, noOtherFeature) },
  {
    files: ['src/core/**'],
    rules: restrict({ regex: '(^|/)(features|app|ui)/', message: 'core/ no importa de la UI.' }),
  },
);
