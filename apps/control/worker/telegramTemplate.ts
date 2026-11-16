export type TemplateValue =
  string | number | boolean | null | TemplateRecord | TemplateValue[];
export type TemplateRecord = { [key: string]: TemplateValue };

type Path = string[];
type Format = "format_date" | "format_datetime" | "format_currency";
type Node =
  | { kind: "text"; text: string }
  | { kind: "value"; path: Path; format?: Format; currency?: Path }
  | { kind: "loop"; alias: string; path: Path; body: Node[] };

const identifier = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const reserved = new Set(["constructor", "prototype", "__proto__"]);
const outputLimit = 3900;

function pathFrom(expression: string): Path {
  const path = expression.trim().split(".");
  if (
    path.length > 12 ||
    path.some((part) => !identifier.test(part) || reserved.has(part))
  )
    throw new Error(`Invalid template field: ${expression}`);
  return path;
}

function parseTemplate(template: string) {
  const root: Node[] = [];
  const stack = [root];
  let offset = 0;
  for (const match of template.matchAll(
    /\{\{([\s\S]*?)\}\}|\{%([\s\S]*?)%\}|(\{\{|\{%)/g,
  )) {
    const body = stack[stack.length - 1];
    if (match.index > offset)
      body.push({ kind: "text", text: template.slice(offset, match.index) });
    offset = match.index + match[0].length;
    if (match[3]) throw new Error("Close the template tag before continuing.");
    if (match[1] !== undefined) {
      const expression = match[1].trim();
      const helper =
        /^(format_date|format_datetime|format_currency)\(([^(),]+)(?:,([^(),]+))?\)$/.exec(
          expression,
        );
      if (helper?.[3] && helper[1] !== "format_currency")
        throw new Error("Only format_currency accepts a second argument.");
      body.push({
        kind: "value",
        path: pathFrom(helper?.[2] ?? expression),
        format: helper?.[1] as Format | undefined,
        currency: helper?.[3] ? pathFrom(helper[3]) : undefined,
      });
      continue;
    }
    const directive = match[2].trim();
    if (directive === "endfor") {
      if (stack.length === 1)
        throw new Error("An endfor tag has no matching for tag.");
      stack.pop();
      continue;
    }
    const loop = /^for\s+([a-zA-Z][a-zA-Z0-9_]*)\s+in\s+(.+)$/.exec(directive);
    if (!loop || loop[1] === "doc" || reserved.has(loop[1]))
      throw new Error("Use {% for item in doc.list %} to start a loop.");
    if (stack.length > 6)
      throw new Error("Templates can nest up to six loops.");
    const children: Node[] = [];
    body.push({
      kind: "loop",
      alias: loop[1],
      path: pathFrom(loop[2]),
      body: children,
    });
    stack.push(children);
  }
  if (stack.length !== 1)
    throw new Error("Close every loop with {% endfor %}.");
  root.push({ kind: "text", text: template.slice(offset) });
  return root;
}

function read(scope: TemplateRecord, path: Path): TemplateValue {
  let value: TemplateValue = scope;
  for (const part of path) {
    if (value === null) return null;
    if (
      typeof value !== "object" ||
      Array.isArray(value) ||
      !Object.hasOwn(value, part)
    )
      throw new Error(`Unknown template field: ${path.join(".")}`);
    value = value[part];
  }
  return value;
}

function dateText(
  value: TemplateValue,
  timezone: string,
  includeTime: boolean,
) {
  if (typeof value !== "string")
    throw new Error("Use a date field with the date formatter.");
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(
    value,
  )
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime()))
    throw new Error("Use a valid date field with the date formatter.");
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeZone: dateOnly ? "UTC" : timezone,
  };
  if (includeTime && !dateOnly) options.timeStyle = "short";
  return new Intl.DateTimeFormat("en-GB", options).format(date);
}

export function renderTelegramTemplate(
  template: string,
  doc: TemplateRecord,
  timezone: string,
) {
  let output = "";
  let remaining = 25_000;
  const visit = (nodes: Node[], scope: TemplateRecord) => {
    for (const node of nodes) {
      if (--remaining <= 0 || output.length > outputLimit) return;
      if (node.kind === "text") {
        output += node.text;
        continue;
      }
      const value = read(scope, node.path);
      if (value === null) continue;
      if (node.kind === "loop") {
        if (!Array.isArray(value))
          throw new Error(`Loop over a list: ${node.path.join(".")}`);
        for (const item of value) {
          if (--remaining <= 0 || output.length > outputLimit) break;
          visit(node.body, { ...scope, [node.alias]: item });
        }
      } else if (node.format === "format_currency") {
        const currency = node.currency
          ? read(scope, node.currency)
          : doc.currency;
        if (
          typeof value !== "number" ||
          typeof currency !== "string" ||
          !/^[A-Z]{3}$/.test(currency)
        )
          throw new Error(
            "Use a numeric amount and currency with format_currency.",
          );
        output += new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          currencyDisplay: "code",
        }).format(value);
      } else if (node.format) {
        output += dateText(value, timezone, node.format === "format_datetime");
      } else {
        if (typeof value === "object")
          throw new Error(
            `Choose a field or loop over a list: ${node.path.join(".")}`,
          );
        output += String(value);
      }
    }
  };
  visit(parseTemplate(template), { doc });
  return output.length > outputLimit || remaining <= 0
    ? `${output
        .slice(0, outputLimit - 2)
        .replace(/[\uD800-\uDBFF]$/, "")
        .trimEnd()}…`
    : output.trim();
}
