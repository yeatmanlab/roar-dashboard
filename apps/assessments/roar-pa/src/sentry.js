import { initSentry as _initSentry } from '../../shared/sentry';

export function initSentry() {
  _initSentry({
    dsn: 'https://26a28547199e506fbdb3f1bd7b419da7@o4505913837420544.ingest.sentry.io/4505915574517760',
    game: 'roar-phoneme',
    gameShortened: 'pa',
  });
}
