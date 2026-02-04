export function renderTemplate(body: string, values: Record<string, string | undefined>) {
  return body.replace(/{{\s*([^\s{}]+)\s*}}/g, (_match, key: string) => values[key] ?? "");
}
