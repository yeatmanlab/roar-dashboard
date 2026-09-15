export const shuffleArr = (arr) => {
  const arrCopy = arr.slice();
  for (let i = arrCopy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrCopy[i], arrCopy[j]] = [arrCopy[j], arrCopy[i]];
  }
  return arrCopy;
};

export const indsRandomNoRepeat = (numInds, lenArr) => {
  const inds = shuffleArr([...Array(lenArr).keys()]).slice(0, numInds);
  return inds;
};

// creates [0, 0, 0, 1, 1, 1, ... , indMax, indMax, indMax]
export const createArrIndsRepeat = (numRepeat, indMax) =>
  Array.from({ length: numRepeat * (indMax + 1) }, (_, i) => i % (indMax + 1));
