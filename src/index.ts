import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import esbuild from 'esbuild';
import randomstring from 'randomstring';
import { Compiler } from './mlem.js';

export async function Compile(file: string) {
  //const source = fs.readFileSync(path.resolve(file), 'utf8');
  const bin = Compiler(file);
  //console.log(bin);
  const idFile = randomstring.generate();
  const buildFile = path.join('dist', idFile + '.ts');
  fs.writeFileSync(buildFile, bin);
  const binOutFile = path.resolve(path.join('dist', idFile + '.js'));

  await esbuild.build({
    entryPoints: [buildFile],
    bundle: true,
    outfile: binOutFile, // file output
    platform: 'node',
    format: 'esm',
    minify: true,
  });
  fs.unlinkSync(buildFile);
  return binOutFile;
}

export function runFile(filePath: string) {
  const absPath = path.resolve(filePath);
  execSync(`node "${absPath}"`, { stdio: 'inherit' });
}
