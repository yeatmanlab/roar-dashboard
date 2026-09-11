export function dashToCamelCase(str) {
  return str.replace(/-([a-z])/gi, (match, letter) => letter.toUpperCase());
}
