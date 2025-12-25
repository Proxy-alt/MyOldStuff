/** @type {import('prettier').Config} */
export default {
  printWidth: 150,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'consistent',
  jsxSingleQuote: false,
  trailingComma: 'none',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  proseWrap: 'preserve',
  htmlWhitespaceSensitivity: 'css',
  endOfLine: 'lf',
  embeddedLanguageFormatting: 'auto',
  vueIndentScriptAndStyle: false,
  singleAttributePerLine: false,
  plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-astro'],

  // File-specific overrides
  overrides: [
    {
      files: '*.md',
      options: {
        proseWrap: 'always',
        printWidth: 80
      }
    },
    {
      files: '*.json',
      options: {
        quoteProps: 'preserve'
      }
    },
    {
      files: '*.astro',
      options: {
        parser: 'astro'
      }
    }
  ]
};
