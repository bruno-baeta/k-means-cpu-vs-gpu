const KEYWORDS = new Set([
  "def", "for", "in", "if", "return", "self", "import", "class", "range", "while", "not", "and", "or",
  "None", "True", "False", "from", "as",
  "__global__", "void", "int", "float", "const", "struct", "unsigned", "long", "auto", "else",
]);

const TOKEN_RE = /(#.*|\/\/.*)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|\b(\d+\.?\d*f?)\b|\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlightLine(line: string): string {
  let out = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(line)) !== null) {
    out += escapeHtml(line.slice(lastIndex, match.index));
    const [full, comment, dstr, sstr, num, ident] = match;

    if (comment) out += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
    else if (dstr) out += `<span class="tok-string">${escapeHtml(dstr)}</span>`;
    else if (sstr) out += `<span class="tok-string">${escapeHtml(sstr)}</span>`;
    else if (num) out += `<span class="tok-number">${escapeHtml(num)}</span>`;
    else if (ident) out += KEYWORDS.has(ident) ? `<span class="tok-keyword">${ident}</span>` : escapeHtml(ident);

    lastIndex = match.index + full.length;
  }
  out += escapeHtml(line.slice(lastIndex));
  return out;
}
