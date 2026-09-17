// Previously named waitFor

export const isTaskFinished = (conditionFunction: Function) => {
  const poll = (resolve: Function) => {
    if (conditionFunction()) {
      resolve();
    } else {
      setTimeout(() => poll(resolve), 400);
    }
  };

  return new Promise(poll);
};
