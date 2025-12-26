export { default as AppMessageState } from './AppMessageState.vue';

export const MESSAGE_STATE_TYPES = Object.freeze({
  EMPTY: 'empty',
  ERROR: 'error',
});

export const TYPE_IMAGES = {
  [MESSAGE_STATE_TYPES.EMPTY]: '/assets/img/roar-empty-state.png',
  [MESSAGE_STATE_TYPES.ERROR]: '/assets/img/roar-error-state.png',
};
