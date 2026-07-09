export function convertStrToBool(str) {
  if (str) {
    return str === 'true';
  } else {
    return str;
  }
}
