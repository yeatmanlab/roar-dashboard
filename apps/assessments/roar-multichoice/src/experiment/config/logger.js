import { Roarr as log } from "roarr";

const getLogLevel = (level) => {
  let prettyLevel;
  switch (level) {
    case 10:
      prettyLevel = "TRACE";
      break;
    case 20:
      prettyLevel = "DEBUG";
      break;
    case 30:
      prettyLevel = "INFO";
      break;
    case 40:
      prettyLevel = "WARN";
      break;
    case 50:
      prettyLevel = "ERROR";
      break;
    case 60:
      prettyLevel = "FATAL";
      break;
    default:
      prettyLevel = "LOG";
  }

  return `[ROAR:${prettyLevel}]`;
};

globalThis.ROARR.write = (message) => {
  const payload = JSON.parse(message);

  if (payload.context.logLevel >= 30) {
    const logLevel = getLogLevel(payload.context.logLevel);
    // eslint-disable-next-line no-console
    console.log(`${logLevel} ${payload.message}`);
  }
};

// eslint-disable-next-line import/prefer-default-export
export { log };
