export class Logger {
  private static instance: Logger;
  private levanteLogger?: LevanteLogger;
  private gameParams?: GameParamsType;
  private userParams?: UserParamsType;
  private constructor(levanteLogger?: LevanteLogger, gameParams?: GameParamsType, userParams?: UserParamsType) {
    this.levanteLogger = levanteLogger;
    this.gameParams = gameParams;
    this.userParams = userParams;
  }

  public static setInstance(levanteLogger?: LevanteLogger, gameParams?: GameParamsType, userParams?: UserParamsType) {
    if (Logger.instance) {
      throw new Error('Logger instance already set');
    }
    Logger.instance = new Logger(levanteLogger, gameParams, userParams);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      throw new Error('Logger instance not set');
    }
    return Logger.instance;
  }

  public capture(name: string, context?: Record<string, any>) {
    const finalProperties = {
      gameParams: this.gameParams,
      userParams: this.userParams,
      context,
    };

    this.levanteLogger?.capture?.(name, finalProperties);
  }

  public error(error: Error | unknown, context?: Record<string, any>) {
    const finalContext = {
      gameParams: this.gameParams,
      userParams: this.userParams,
      context,
    };

    this.levanteLogger?.error?.(error, finalContext);
  }
}
