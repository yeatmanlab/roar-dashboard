// Previously named waitFor

export const isTaskFinished = (conditionFunction: () => boolean, frequency = 400) => {
  return new Promise<void>((resolve) => {
    const poll = () => {
      if (conditionFunction()) {
        resolve();
      } else {
        setTimeout(poll, frequency);
      }
    };
    poll();
  });
};
