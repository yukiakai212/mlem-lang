// mlemc-strings.js
// Mlem -> WAT -> wasm with typed params :i, :f, :s
// Strings are stored in JS stringHeap and passed to wasm as i64 ids.
// Requires: npm i wabt

import module from 'node:module';
const require = module.createRequire(import.meta.url);
//const wabtPromise = require("wabt")();

// mlemc-floats.js
// Mlem -> WAT -> wasm with int (i64) and float (f64) support.
// Requires: npm i wabt
const wabtPromise = require("wabt")();

// ----------------- LEXER -----------------
function lexer(input) {
  const tokens = [];
  const re = /\s*(\d+\.\d+f|\d+|"(?:[^"\\]|\\.)*"|let\b|print\b|func\b|return\b|while\b|for\b|[a-zA-Z_]\w*|<=|>=|==|<|>|\+|-|\*|\/|=|\(|\)|,|\{|\}|;)\s*/gy;
  let m;
  while ((m = re.exec(input)) !== null) {
    const t = m[1];
    if (/^let$/.test(t)) tokens.push({ type: 'LET' });
    else if (/^print$/.test(t)) tokens.push({ type: 'PRINT' });
    else if (/^func$/.test(t)) tokens.push({ type: 'FUNC' });
    else if (/^return$/.test(t)) tokens.push({ type: 'RETURN' });
    else if (/^while$/.test(t)) tokens.push({ type: 'WHILE' });
    else if (/^for$/.test(t)) tokens.push({ type: 'FOR' });
    else if (/^\d+\.\d+f$/.test(t)) tokens.push({ type: 'FLOAT', value: t.slice(0, -1) }); // remove trailing f
    else if (/^\d+$/.test(t)) tokens.push({ type: 'INT', value: t });
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

  function parseTerm() {
    const tk = peek();
    if (!tk) throw new Error('Unexpected EOF in term');
    if (tk.type === 'INT') { next(); return { type: 'IntLiteral', value: tk.value }; }
    if (tk.type === 'FLOAT') { next(); return { type: 'FloatLiteral', value: tk.value }; }
    if (tk.type === 'STRING') { next(); return { type: 'StringLiteral', value: tk.value }; }
    if (tk.type === 'IDENT') {
      const id = tk.value; next();
      if (peek() && peek().type === '(') {
        next(); // (
        const args = [];
        if (peek() && peek().type !== ')') {
          args.push(parseExpr());
          while (peek() && peek().type === ',') { next(); args.push(parseExpr()); }
        }
        if (!peek() || peek().type !== ')') throw new Error('Expected ) after call args');
        next(); // )
        return { type: 'Call', name: id, args };
      }
      return { type: 'Ident', name: id };
    }
    if (tk.type === '(') { next(); const e = parseExpr(); if (!peek() || peek().type !== ')') throw new Error('Expected )'); next(); return e; }
    throw new Error('Unexpected term: ' + JSON.stringify(tk));
  }

  function parseExpr() {
    let left = parseTerm();
    while (peek() && ['+','-','*','/','<','>','==','<=','>='].includes(peek().type)) {
      const op = next().type;
      const right = parseTerm();
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  function parseStatement() {
    const tk = peek();
    if (!tk) return null;

    if (tk.type === 'LET') {
      next();
      const id = next(); if (!id || id.type !== 'IDENT') throw new Error('Expected ident after let');
      if (!peek() || peek().type !== '=') throw new Error("Expected '=' after identifier");
      next(); // =
      const expr = parseExpr();
      if (peek() && peek().type === ';') next();
      return { type: 'Let', name: id.value, expr };
    }

    if (tk.type === 'PRINT') {
      next();
      const expr = parseExpr();
      if (peek() && peek().type === ';') next();
      return { type: 'Print', expr };
    }

    if (tk.type === 'FUNC') {
      next();
      const id = next(); if (!id || id.type !== 'IDENT') throw new Error('Expected function name');
      if (!peek() || peek().type !== '(') throw new Error('Expected ( after func name');
      next();
      const params = [];
      if (peek() && peek().type !== ')') {
        const p = next(); if (!p || p.type !== 'IDENT') throw new Error('Expected param'); params.push(p.value);
        while (peek() && peek().type === ',') { next(); const q = next(); if (!q || q.type !== 'IDENT') throw new Error('Expected param'); params.push(q.value); }
      }
      if (!peek() || peek().type !== ')') throw new Error('Expected ) after params');
      next();
      if (!peek() || peek().type !== '{') throw new Error('Expected { after func header');
      next(); // {
      const body = [];
      while (peek() && peek().type !== '}') body.push(parseFunctionStmt());
      if (!peek() || peek().type !== '}') throw new Error('Expected } after func body');
      next(); // }
      return { type: 'Func', name: id.value, params, body };
    }

    if (tk.type === 'RETURN') {
      next();
      const expr = parseExpr();
      if (peek() && peek().type === ';') next();
      return { type: 'Return', expr };
    }

    if (tk.type === 'WHILE') {
      next();
      const cond = parseExpr();
      if (!peek() || peek().type !== '{') throw new Error('Expected { after while condition');
      next();
      const body = [];
      while (peek() && peek().type !== '}') body.push(parseFunctionStmt());
      if (!peek() || peek().type !== '}') throw new Error('Expected } after while body');
      next();
      return { type: 'While', cond, body };
    }

    if (tk.type === 'FOR') {
      next();
      // for <init>; <cond>; <update> { body }
      let init = null, cond = null, update = null;
      if (peek() && peek().type !== ';') init = parseStatement();
      if (!peek() || peek().type !== ';') throw new Error('Expected ; after for init');
      next(); // ;
      if (peek() && peek().type !== ';') cond = parseExpr();
      if (!peek() || peek().type !== ';') throw new Error('Expected ; after for cond');
      next(); // ;
      if (peek() && peek().type !== '{') update = parseStatement();
      if (!peek() || peek().type !== '{') throw new Error('Expected { after for header');
      next(); // {
      const body = [];
      while (peek() && peek().type !== '}') body.push(parseFunctionStmt());
      if (!peek() || peek().type !== '}') throw new Error('Expected } after for body');
      next(); // }
      return { type: 'For', init, cond, update, body };
    }

    throw new Error('Unknown statement: ' + JSON.stringify(tk));
  }

  function parseFunctionStmt() {
    const tk = peek();
    if (!tk) return null;
    if (tk.type === 'LET') {
      next(); const id = next(); if (!id || id.type !== 'IDENT') throw new Error('Expected ident after let'); next(); // =
      const expr = parseExpr(); if (peek() && peek().type === ';') next();
      return { type: 'Let', name: id.value, expr };
    }
    if (tk.type === 'PRINT') { next(); const expr = parseExpr(); if (peek() && peek().type === ';') next(); return { type: 'Print', expr }; }
    if (tk.type === 'RETURN') { next(); const expr = parseExpr(); if (peek() && peek().type === ';') next(); return { type: 'Return', expr }; }
    // expression statement (call or assignment like x = ...)
    const maybe = parseExpr();
    if (peek() && peek().type === '=') {
      // assignment to ident: expr = rhs  (we only accept ident = expr)
      if (maybe.type !== 'Ident') throw new Error('Left side of assignment must be identifier');
      next(); // =
      const rhs = parseExpr();
      if (peek() && peek().type === ';') next();
      return { type: 'Assign', name: maybe.name, expr: rhs };
    }
    if (peek() && peek().type === ';') next();
    return { type: 'ExprStmt', expr: maybe };
  }

  function parseProgram() {
    const body = [];
    while (pos < tokens.length) {
      body.push(parseStatement());
    }
    return { type: 'Program', body };
  }

  return { parseProgram };
}

// ----------------- TYPE INFERENCE + CODEGEN HELP -----------------
// types: 'i64' | 'f64' | 'string'
function inferExprType(expr, localsSet) {
  switch (expr.type) {
    case 'IntLiteral': return 'i64';
    case 'FloatLiteral': return 'f64';
    case 'StringLiteral': return 'string';
    case 'Ident':
      return localsSet && localsSet.has(expr.name) ? localsSet.get(expr.name) || 'i64' : (localsSet ? 'i64' : 'i64');
    case 'Call':
      // For simplicity: assume function declared before use; real impl should lookup func signature
      // We'll assume functions return i64 unless their body contains float return; we'll set signature later.
      return 'i64';
    case 'Binary': {
      const lt = inferExprType(expr.left, localsSet);
      const rt = inferExprType(expr.right, localsSet);
      if (lt === 'string' || rt === 'string') return 'string';
      if (lt === 'f64' || rt === 'f64') return 'f64';
      return 'i64';
    }
    default: return 'i64';
  }
}

// ----------------- CODEGEN -----------------
function escape(name) { return name.replace(/[^0-9A-Za-z_]/g, '_'); }

function genModule(ast) {
  // collect globals and funcs
  const globals = new Set();
  const funcs = [];
  for (const s of ast.body) {
    if (s.type === 'Let') globals.add(s.name);
    if (s.type === 'Func') funcs.push(s);
  }

  // string heap
  const stringHeap = new Map();
  let stringCounter = 1;

  // will collect function signatures (name -> resultType)
  const funcSignatures = new Map();

  // first pass: try to infer function result type (if contains Return float => f64 else i64)
  for (const f of funcs) {
    let resType = 'i64';
    for (const st of f.body) {
      if (st.type === 'Return') {
        const t = inferExprType(st.expr, new Map(f.params.map(p => [p, 'i64'])));
        if (t === 'f64') resType = 'f64';
      }
    }
    funcSignatures.set(f.name, resType);
  }

  function genExpr(expr, localsMap) {
    // returns { code: [lines], type: 'i64'|'f64'|'string' }
    switch (expr.type) {
      case 'IntLiteral': return { code: [`(i64.const ${expr.value})`], type: 'i64' };
      case 'FloatLiteral': return { code: [`(f64.const ${expr.value})`], type: 'f64' };
      case 'StringLiteral': {
        const id = stringCounter++;
        stringHeap.set(id, expr.value);
        // represent string as i64 id
        return { code: [`(i64.const ${id})`], type: 'i64', isStringId: true };
      }
      case 'Ident': {
        if (localsMap && localsMap.has(expr.name)) {
          const t = localsMap.get(expr.name) || 'i64';
          return { code: [`(local.get $${escape(expr.name)})`], type: t };
        } else {
          return { code: [`(global.get $${escape(expr.name)})`], type: 'i64' };
        }
      }
      case 'Call': {
        // generate args; get signature
        const sig = funcSignatures.get(expr.name) || 'i64';
        let parts = [];
        for (const a of expr.args) {
          const pa = genExpr(a, localsMap);
          parts.push(...pa.code);
          // if param expected f64 but arg is i64, convert
          // (we don't know param types precisely here; assume params typed i64 for simplicity)
        }
        parts.push(`(call $${escape(expr.name)})`);
        return { code: parts, type: sig };
      }
      case 'Binary': {
        const L = genExpr(expr.left, localsMap);
        const R = genExpr(expr.right, localsMap);
        // string concat when op '+' and any side is string -> perform JS-side concat
        if ((L.type === 'string' || R.type === 'string') && expr.op === '+') {
          // produce string id via runtime concat helper? To keep simple: we disallow direct string concat in wasm here.
          // We'll fallback to convert both to string IDs in JS print or require user to use functions. For now throw.
          throw new Error('String concatenation not supported in this simple codegen. Convert to JS helper if needed.');
        }

        // if either is f64 => promote both to f64
        if (L.type === 'f64' || R.type === 'f64') {
          const leftCode = (L.type === 'i64') ? [`(f64.convert_i64_s ${L.code.join(' ')})`] : L.code;
          const rightCode = (R.type === 'i64') ? [`(f64.convert_i64_s ${R.code.join(' ')})`] : R.code;
          const opMap = { '+': 'f64.add', '-': 'f64.sub', '*': 'f64.mul', '/': 'f64.div' };
          const cmpMap = { '<': 'f64.lt', '>': 'f64.gt', '==': 'f64.eq', '<=': 'f64.le', '>=': 'f64.ge' };
          if (['+','-','*','/'].includes(expr.op)) {
            return { code: [...leftCode, ...rightCode, `(${opMap[expr.op]})`], type: 'f64' };
          } else {
            // comparison -> returns i32 (WASM). We'll keep type 'i64' with value 0/1 by converting i32->i64
            const cmp = cmpMap[expr.op] || 'f64.eq';
            return { code: [...leftCode, ...rightCode, `(${cmp})`, '(i32.extend_i32_s)', '(i64.extend_i32_u)'], type: 'i64' };
          }
        } else {
          // integer operations
          const opMap = { '+': 'i64.add', '-': 'i64.sub', '*': 'i64.mul', '/': 'i64.div_s' };
          const cmpMap = { '<': 'i64.lt_s', '>': 'i64.gt_s', '==': 'i64.eq', '<=': 'i64.le_s', '>=': 'i64.ge_s' };
          if (['+','-','*','/'].includes(expr.op)) {
            return { code: [...L.code, ...R.code, `(${opMap[expr.op]})`], type: 'i64' };
          } else {
            // comparison => i32 -> convert to i64 0/1 for uniformity
            const cmp = cmpMap[expr.op] || 'i64.eq';
            return { code: [...L.code, ...R.code, `(${cmp})`, '(i32.extend_i32_s)', '(i64.extend_i32_u)'], type: 'i64' };
          }
        }
      }
      default: throw new Error('Unhandled expr: ' + JSON.stringify(expr));
    }
  }

  function genStmt(stmt, localsMap) {
    // returns array of code lines (already indented in caller)
    if (stmt.type === 'Let') {
      if (localsMap && localsMap.has(stmt.name)) {
        const g = genExpr(stmt.expr, localsMap);
        // need to convert to local type if mismatch
        const localType = localsMap.get(stmt.name) || 'i64';
        if (localType === 'f64' && g.type === 'i64') {
          return [...g.code, `(f64.convert_i64_s)`, `local.set $${escape(stmt.name)}`];
        } else if (localType === 'i64' && g.type === 'f64') {
          // convert f64 -> i64 (trunc) — use f64.demote? No, to i64 we use i64.trunc_f64_s
          return [...g.code, `(i64.trunc_f64_s)`, `local.set $${escape(stmt.name)}`];
        } else {
          return [...g.code, `local.set $${escape(stmt.name)}`];
        }
      } else {
        const g = genExpr(stmt.expr, localsMap);
        if (g.type === 'f64') {
          // cannot store f64 into global i64: convert to i64 by truncation (user should avoid mixing)
          return [...g.code, `(i64.trunc_f64_s)`, `global.set $${escape(stmt.name)}`];
        } else {
          return [...g.code, `global.set $${escape(stmt.name)}`];
        }
      }
    }

    if (stmt.type === 'Assign') {
      // assignment to existing var (local or global)
      if (localsMap && localsMap.has(stmt.name)) {
        const g = genExpr(stmt.expr, localsMap);
        const localType = localsMap.get(stmt.name) || 'i64';
        if (localType === 'f64' && g.type === 'i64') return [...g.code, `(f64.convert_i64_s)`, `local.set $${escape(stmt.name)}`];
        if (localType === 'i64' && g.type === 'f64') return [...g.code, `(i64.trunc_f64_s)`, `local.set $${escape(stmt.name)}`];
        return [...g.code, `local.set $${escape(stmt.name)}`];
      } else {
        const g = genExpr(stmt.expr, localsMap);
        if (g.type === 'f64') return [...g.code, `(i64.trunc_f64_s)`, `global.set $${escape(stmt.name)}`];
        return [...g.code, `global.set $${escape(stmt.name)}`];
      }
    }

    if (stmt.type === 'Print') {
      const g = genExpr(stmt.expr, localsMap);
      if (g.type === 'f64') return [...g.code, `call $print_f64`];
      // i64 or string id -> use print_i64
      return [...g.code, `call $print_i64`];
    }

    if (stmt.type === 'Return') {
      const g = genExpr(stmt.expr, localsMap);
      return [...g.code, `return`];
    }

    if (stmt.type === 'ExprStmt') {
      const g = genExpr(stmt.expr, localsMap);
      // drop return value if any (f64 or i64)
      if (g.type === 'f64') return [...g.code, `drop`];
      return [...g.code, `drop`];
    }

    if (stmt.type === 'While') {
      // cond, body
      // pattern: block loop <cond> eqz br_if 1 <body> br 0 end end
      const cond = stmt.cond;
      const cb = genExpr(cond, localsMap);
      const bodyCode = stmt.body.map(s => genStmt(s, localsMap)).flat();
      const condIsFloat = cb.type === 'f64';
      const condCode = cb.code;
      if (condIsFloat) {
        return [
          'block',
          'loop',
          ...condCode,
          '(f64.const 0.0)',
          '(f64.eq)',      // i32 1 if == 0.0
          '(i32.eqz)',     // invert? Wait we want br_if when cond == 0, so we want the result of f64.eq directly
          // But simpler: do f64.eq -> returns i32 (1 if equal). br_if exits when equal, so:
          // Actually we want: if cond == 0 -> exit => f64.eq -> 1 -> br_if 1
        ];
      }
      // We'll implement correctly below in structured way in final assembling.
    }

    if (stmt.type === 'For') {
      // We'll transform into init; block loop check body update br 0 end end
      const parts = [];
      if (stmt.init) parts.push(...genStmt(stmt.init, localsMap));
      const cond = stmt.cond;
      const update = stmt.update;
      const bodyCode = stmt.body.map(s => genStmt(s, localsMap)).flat();
      // cond may be null => infinite loop
      if (!cond) {
        // infinite loop
        parts.push('block', 'loop', ...bodyCode, ...(update ? genStmt(update, localsMap) : []), 'br 0', 'end', 'end');
      } else {
        const c = genExpr(cond, localsMap);
        if (c.type === 'f64') {
          parts.push('block', 'loop', ...c.code, '(f64.const 0.0)', '(f64.eq)', 'br_if 1', ...bodyCode, ...(update ? genStmt(update, localsMap) : []), 'br 0', 'end', 'end');
        } else {
          parts.push('block', 'loop', ...c.code, '(i64.eqz)', 'br_if 1', ...bodyCode, ...(update ? genStmt(update, localsMap) : []), 'br 0', 'end', 'end');
        }
      }
      return parts;
    }

    throw new Error('Unknown stmt in genStmt: ' + JSON.stringify(stmt));
  }

  // build wat
  let wat = '(module\n';
  // imports: print_i64, print_f64
  wat += '  (import "js" "print_i64" (func $print_i64 (param i64)))\n';
  wat += '  (import "js" "print_f64" (func $print_f64 (param f64)))\n';

  // globals
  for (const g of globals) {
    wat += `  (global $${escape(g)} (mut i64) (i64.const 0))\n`;
  }

  // functions
  for (const f of funcs) {
    // collect local lets as locals
    const localNames = [];
    for (const st of f.body) {
      if (st.type === 'Let') localNames.push(st.name);
      if (st.type === 'Assign') {} // ignore
    }
    // build localsMap: params typed i64 by default unless we detect float returns (we kept signature earlier)
    const paramTypes = f.params.map(p => 'i64'); // for simplicity params are i64 by default; user may pass float but we will convert where needed
    // but better: attempt to infer param types by seeing Return expr types where params used -> skip complexity
    const localsMap = new Map();
    for (const p of f.params) localsMap.set(p, 'i64');
    for (const ln of localNames) localsMap.set(ln, 'i64');
    // check if any Return expression is float -> set result type
    const resultType = funcSignatures.get(f.name) || 'i64';
    // declare func
    const paramsSig = f.params.map(p => `(param $${escape(p)} i64)`).join(' ');
    const localsDecl = localNames.map(l => `(local $${escape(l)} i64)`).join(' ');
    const resultSig = resultType === 'f64' ? '(result f64)' : '(result i64)';
    wat += `  (func $${escape(f.name)} ${paramsSig} ${resultSig}\n`;
    if (localsDecl) wat += `    ${localsDecl}\n`;
    // body
    let emitted = [];
    for (const st of f.body) {
      // special-case Return to return right type
      if (st.type === 'Return') {
        const re = genExpr(st.expr, localsMap);
        if (resultType === 'f64' && re.type === 'i64') {
          emitted.push(...re.code);
          emitted.push('(f64.convert_i64_s)');
          emitted.push('return');
        } else if (resultType === 'i64' && re.type === 'f64') {
          emitted.push(...re.code);
          emitted.push('(i64.trunc_f64_s)');
          emitted.push('return');
        } else {
          emitted.push(...re.code);
          emitted.push('return');
        }
      } else {
        emitted.push(...genStmt(st, localsMap));
      }
    }
    // default return
    if (![...f.body].some(s => s.type === 'Return')) {
      if (resultType === 'f64') emitted.push('(f64.const 0.0)');
      else emitted.push('(i64.const 0)');
    }
    // indent emitted
    for (const line of emitted) {
      wat += `    ${line}\n`;
    }
    wat += '  )\n';
  }

  // main
  wat += '  (func $main\n';
  for (const s of ast.body) {
    if (s.type === 'Let') {
      // global set
      const ge = genExpr(s.expr, null);
      if (ge.type === 'f64') {
        wat += `    ${ge.code.join(' ')}\n    (i64.trunc_f64_s)\n    global.set $${escape(s.name)}\n`;
      } else {
        wat += `    ${ge.code.join(' ')}\n    global.set $${escape(s.name)}\n`;
      }
    } else if (s.type === 'Print') {
      const ge = genExpr(s.expr, null);
      if (ge.type === 'f64') {
        wat += `    ${ge.code.join(' ')}\n    call $print_f64\n`;
      } else {
        wat += `    ${ge.code.join(' ')}\n    call $print_i64\n`;
      }
    } else if (s.type === 'Func') {
      // already emitted
    } else {
      // other top-level stmts (while/for)
      const lines = genStmt(s, null);
      for (const line of lines) wat += `    ${line}\n`;
    }
  }
  wat += '  )\n';
  wat += '  (start $main)\n';
  wat += ')\n';

  return { wat, stringHeap };
}

// ----------------- DEMO / RUN -----------------
async function runDemo() {
  const src = `
let x = 10
let y = 2.5f
let msg = "hello"

func add(a, b) {
  return a + b
}

func average(a, b) {
  let s = a + b
  return s / 2f
}

print x
print y
print add(x, 5)
print add(1f, 2f)
print average(3f, 5f)

let i = 0
while i < 3 {
  print i
  i = i + 1
}

for let j = 0; j < 3; j = j + 1 {
  print j
}
`;

  const cleaned = src; // no comments here
  const tokens = lexer(cleaned);
  const ast = Parser(tokens).parseProgram();
  const { wat, stringHeap } = genModule(ast);

  console.log('=== GENERATED WAT ===\n', wat);

  const wabt = await wabtPromise;
  const mod = wabt.parseWat('mlem.wat', wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });

  const imports = {
    js: {
      print_i64: (n) => {
        // n is BigInt in many engines
        if (typeof n === 'bigint') {
          // check stringHeap
          const id = Number(n);
          if (stringHeap.has(id)) console.log(stringHeap.get(id));
          else console.log(String(n));
        } else {
          // number fallback
          console.log(String(n));
        }
      },
      print_f64: (n) => {
        console.log(String(n));
      }
    }
  };

  await WebAssembly.instantiate(buffer, imports);
  console.log('== wasm module instantiated and start(main) ran ==');
}

runDemo().catch(e => { console.error(e); process.exit(1); });
