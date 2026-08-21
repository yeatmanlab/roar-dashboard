const TIMEOUT_POLL = 400;
export const isTaskFinished = (conditionFunction) => {
  const poll = (resolve) => {
    if (conditionFunction()) resolve();
    // eslint-disable-next-line no-unused-vars
    else setTimeout((_) => poll(resolve), TIMEOUT_POLL);
  };

  return new Promise(poll);
};
