import path from 'node:path';
import fs from 'node:fs';

// ----------------- LEXER -----------------
function lexer(input) {
  const tokens = [];
  const re =
    /\s*(\d+\.\d+f|\d+|"(?:[^"\\]|\\.)*"|mlem\b|MLEM\b|print\b|func\b|return\b|while\b|for\b|[a-zA-Z_]\w*|:[s|i|f]|\[|\]|\.|<=|>=|==|<|>|\+|-|\*|\/|=|\(|\)|,|\{|\}|;)\s*/gy;
  let m;
  while ((m = re.exec(input)) !== null) {
    const t = m[1];
    if (/^mlem$/.test(t)) tokens.push({ type: 'LET' });
    else if (/^MLEM$/.test(t)) tokens.push({ type: 'CONST' });
    else if (/^print$/.test(t)) tokens.push({ type: 'PRINT' });
    else if (/^func$/.test(t)) tokens.push({ type: 'FUNC' });
    else if (/^return$/.test(t)) tokens.push({ type: 'RETURN' });
    else if (/^while$/.test(t)) tokens.push({ type: 'WHILE' });
    else if (/^for$/.test(t)) tokens.push({ type: 'FOR' });
    else if (/^\d+\.\d+$/.test(t)) tokens.push({ type: 'FLOAT', value: t });
    else if (/^\d+$/.test(t)) tokens.push({ type: 'INT', value: t });
    else if (/^:[s|i|f]$/.test(t)) tokens.push({ type: 'TYPE', value: t.slice(1) });
    else if (/^"(?:[^"\\]|\\.)*"$/.test(t)) tokens.push({ type: 'STRING', value: JSON.parse(t) });
    else if (/^[A-Za-z_]\w*$/.test(t)) tokens.push({ type: 'IDENT', value: t });
    else tokens.push({ type: t });
  }
  return tokens;
}

// ----------------- PARSER -----------------
function Parser(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const prev = () => tokens[pos--];

  const body = [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    pos = i;
    if (tk.type === 'LET') body.push('let ');
    else if (tk.type === 'CONST') body.push('const ');
    else if (tk.type === 'PRINT') body.push('console.log');
    else if (tk.type === 'FUNC') body.push('function ');
    else if (tk.type === 'RETURN') body.push('return ');
    else if (tk.type === 'WHILE') body.push('while ');
    else if (tk.type === 'FOR') body.push('for ');
    else if (tk.type === 'STRING') body.push(`"${tk.value}"`);
    else if (tk.type === 'TYPE') {
      if (tk.value === 's') body.push(':string');
      else if (tk.value === 'f' || tk.value === 'i') body.push(':number');
    } else if (tk.type === '==') body.push('===');
    else body.push(tk.value || tk.type);
  }

  return body.join('');
}
function Reader(sourceFile: string): string {
  const source = fs.readFileSync(sourceFile, 'utf8');
  const codes = importFile(source, sourceFile).replaceAll('\r', '').split('\n');
  const cleanedSource = [];
  let blockComment = false;
  for (const code of codes) {
    if (code.startsWith('//')) continue;
    else if (code.startsWith('//mlem')) blockComment = !blockComment;
    else cleanedSource.push(code);
  }
  return cleanedSource.join('\n');
}
function importFile(source: string, fileSource: string, files: string[] = []): string {
  const regex = /mlick\s+"([^"]+)"/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const file = match[1];
    if (!file || files.includes(file)) continue;
    const code = fs.readFileSync(path.resolve(path.dirname(fileSource), file), 'utf8');
    files.push(file);
    source = source.replaceAll(match[0], code + '\n');
    return importFile(source, file, files);
  }
  return source;
}

// ----------------- DEMO / RUN -----------------
export function Compiler(srcFile: string) {
  const cleaned = Reader(srcFile); // no comments here
  const tokens = lexer(cleaned);
  //console.log(tokens);
  const code = Parser(tokens);
  return code;
  //console.log(code);
}
