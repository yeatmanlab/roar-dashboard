export const convertItemToString = (item: string | number[]): string => {
  if (typeof item === 'string') {
    return item;
  }
  return item.join(', ');
};
