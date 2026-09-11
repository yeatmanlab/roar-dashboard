// converts a string to camel case
export function camelize(string: string) {
  return string.replace(/^([A-Z])|[\s-_](\w)/g, function (_0, p1, p2, _1) {
    if (p2) return p2.toUpperCase();
    return p1.toLowerCase();
  });
}
