# MLEM (Modern Language for Every Machine)

[![Build Status][github-build-url]][github-url]

**Mlem Lang** (Modern Language for Every Machine) is an **experimental programming language** designed to explore new ideas in syntax and compilation.  
It is **not** intended to replace or compete with production-ready languages.

**Important Notice:**  
> This is a **research project**. It is **not recommended** for production use.  
> Syntax, APIs, and behavior may change at any time without prior notice.

---

##  Key Features

- JavaScript-like syntax with lightweight type declarations (`i` for integer, `f` for float, `s` for string, etc.).
- Library imports via `mlick`.
- Familiar control structures: `while`, `for`, `func`.
- Easy to read and write — designed for compiler & VM experiments.

---

## Example Syntax

```mlem
mlick "lib.mlem";

mlem x:i = 10; // interger
mlem y:f = 2.5; // float
mlem msg:s = "hello"; // string
MLEM HI = "hello"; // const

// multi line comment with : //mlem .... //mlem
// single line comment with: //

//mlem
//function
func add(a, b) { 
  return a + b;
}
//mlem

func average(a, b) {
  mlem s = a + b;
  return s / 2;
}
//print
print(fuck());
print(x);
//print(y)

mlem i = 0;
while (i < 3) {
  print(i);
  i = i + 1;
}

for (mlem j = 0; j < 3; j = j + 1) {
  print(j);
}
````

---

## Current Status

* [x] Basic parser
* [x] Experimental compiler to JavaScript/WASM
* [ ] Stable standard library
* [ ] Tooling & debugger

---

## Limitations

* Not optimized for performance.
* No guaranteed backward compatibility.
* Tested only in limited runtime environments.

---

##  License

MIT License © 2025 [Yuki Akai](https://github.com/yukiakai212/) — For research purposes only.
No warranty, no guarantee of stability.

---

[github-build-url]: https://github.com/yukiakai212/mlem-lang/actions/workflows/build.yml/badge.svg
[github-url]: https://github.com/yukiakai212/mlem-lang/
