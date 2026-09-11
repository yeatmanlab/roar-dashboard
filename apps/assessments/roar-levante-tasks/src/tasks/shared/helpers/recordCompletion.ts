export function recordCompletion(config: Record<string, any>) {
  if (!config?.firekit?.run?.completed) {
    config.firekit.finishRun();
  }
}
