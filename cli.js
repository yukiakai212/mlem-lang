import { Compile, runFile } from './dist/index.js';
const filePath = process.argv[2];
if (!filePath) {
  console.error('Error: No input file provided.');
  process.exit(1);
}
const file = await Compile(filePath);
runFile(file);
