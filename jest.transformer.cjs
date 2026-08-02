const ts = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    const result = ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        esModuleInterop: true,
        isolatedModules: true,
        module: ts.ModuleKind.ES2022,
        sourceMap: true,
        target: ts.ScriptTarget.ES2022,
      },
    });

    return {
      code: result.outputText,
    };
  },
};
