export function dashToCamelCase(str: string) {
  return str.replace(/-([a-z])/gi, (match, letter) => letter.toUpperCase());
}
