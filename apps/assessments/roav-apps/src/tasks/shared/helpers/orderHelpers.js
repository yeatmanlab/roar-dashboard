export const shuffleArr = (arr) => {
  const arrCopy = arr.slice();
  for (let i = arrCopy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrCopy[i], arrCopy[j]] = [arrCopy[j], arrCopy[i]];
  }
  return arrCopy;
};

// indsRandomNoRepeat(3,8) returns 3 distinct indices out ot range [0...7]
// for example, it might return [5, 2, 7]
export const indsRandomNoRepeat = (numInds, lenArr) => {
  const inds = shuffleArr([...Array(lenArr).keys()]).slice(0, numInds);
  return inds;
};

export const indsRandomNoRepeatExcl = (numInds, lenArr, indsExcl) => {
  const pool = [...Array(lenArr).keys()].filter((i) => !indsExcl.includes(i));
  return shuffleArr(pool).slice(0, numInds);
};

export const indsRandomExcl = (numInds, lenArr, indsExcl) => {
  const pool = [...Array(lenArr).keys()].filter((i) => !indsExcl.includes(i));
  return Array.from(
    { length: numInds },
    () => pool[Math.floor(Math.random() * pool.length)],
  );
};

export const indRandom = (lenArr) => Math.floor(Math.random() * lenArr);

export const indRandomExcl = (lenArr, indsExcl) => {
  const pool = [...Array(lenArr).keys()].filter((i) => !indsExcl.includes(i));
  return pool[Math.floor(Math.random() * pool.length)];
};

export const elemRandom = (arr) => {
  const ind = indRandom(arr.length);
  return arr[ind];
};

export const elemRandomExcl = (arr, elemsExcl) => {
  const pool = arr.filter((e) => !elemsExcl.includes(e));
  return pool[Math.floor(Math.random() * pool.length)];
};

export const elemsRandom = (numInds, arr) =>
  Array.from(
    { length: numInds },
    () => arr[Math.floor(Math.random() * arr.length)],
  );

// creates [0, 0, 0, 1, 1, 1, ... , indMax, indMax, indMax]
export const createArrIndsRepeat = (numRepeat, indMax) =>
  Array.from({ length: numRepeat * (indMax + 1) }, (_, i) => i % (indMax + 1));
