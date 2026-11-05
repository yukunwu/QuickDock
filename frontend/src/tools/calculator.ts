// Recursive descent grammar; never executes JavaScript or accepts identifiers.
export function calculate(source: string): string {
  const text = source
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/−/g, "-");
  if (text.length > 4096) throw new Error("算式过长");
  const tokens =
    text.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+\-*/%]|\S/g) || [];
  let pos = 0,
    depth = 0;
  const atom = (): number => {
    if (++depth > 100) throw new Error("括号嵌套过深");
    let n: number;
    const t = tokens[pos++];
    if (t === "+" || t === "-") n = (t === "-" ? -1 : 1) * atom();
    else if (t === "(") {
      n = sum();
      if (tokens[pos++] !== ")") throw new Error("缺少右括号");
    } else if (t && /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(t))
      n = Number(t);
    else throw new Error("请输入有效的数字和四则算式");
    while (tokens[pos] === "%") {
      pos++;
      n /= 100;
    }
    depth--;
    return n;
  };
  const product = (): number => {
    let n = atom();
    while (tokens[pos] === "*" || tokens[pos] === "/") {
      const op = tokens[pos++],
        r = atom();
      if (op === "/" && r === 0) throw new Error("不能除以零");
      n = op === "*" ? n * r : n / r;
    }
    return n;
  };
  const sum = (): number => {
    let n = product();
    while (tokens[pos] === "+" || tokens[pos] === "-") {
      const op = tokens[pos++],
        r = product();
      n = op === "+" ? n + r : n - r;
    }
    return n;
  };
  const result = sum();
  if (pos !== tokens.length) throw new Error("算式包含无效字符或缺少运算符");
  if (!Number.isFinite(result)) throw new Error("结果超出数值范围");
  return String(Number(result.toPrecision(15)));
}
