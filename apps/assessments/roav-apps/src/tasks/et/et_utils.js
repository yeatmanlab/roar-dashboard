export const et_calcMedian = (arr) => {
  const lenArr = arr.length;
  const indHalf = Math.floor(lenArr / 2);
  let med = 0;
  if (lenArr % 2 === 1) {
    med = arr[indHalf];
  } else {
    med = (arr[indHalf - 1] + arr[indHalf]) / 2;
  }
  return med;
};

export const et_calcMedianTrim = (arr, percTrimLow = 0, percTrimHigh = 0) => {
  if (arr.length === 0) return 0;
  arr.sort((a, b) => a - b);
  const indStart = Math.floor((arr.length * percTrimLow) / 100);
  const indEnd = arr.length - Math.floor((arr.length * percTrimHigh) / 100);
  const arrTrimmed = arr.slice(indStart, indEnd);
  return et_calcMedian(arrTrimmed);
};

export const et_calcMedianArrStruct = (arrStruct, key) =>
  et_calcMedian(arrStruct.map((m) => m[key]));

export const et_calcMedianTrimArrStruct = (
  arrStruct,
  key,
  percTrimLow = 0,
  percTrimHigh = 0,
) =>
  et_calcMedianTrim(
    arrStruct.map((m) => m[key]),
    percTrimLow,
    percTrimHigh,
  );
