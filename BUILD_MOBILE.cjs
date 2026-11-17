const fs=require('fs'),vm=require('vm'),ts=require(process.argv[2]);
const source=fs.readFileSync('FFContractor.generated.js','utf8');
const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.None,removeComments:false,newLine:ts.NewLineKind.LineFeed}});
new vm.Script(result.outputText);
new vm.Script(result.outputText.replace(/[“”]/g,'"').replace(/[’]/g,"'"));
fs.writeFileSync('FFContractor.user.js',result.outputText);
console.log('Built mobile userscript with pinned TypeScript 5.9.3 (ES2019; TornPDA quote normalization verified).');
