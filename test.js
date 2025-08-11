import { Compile, runFile } from './src/index.js';
const file = await Compile('./mlem/test.mlem');
runFile(file);
