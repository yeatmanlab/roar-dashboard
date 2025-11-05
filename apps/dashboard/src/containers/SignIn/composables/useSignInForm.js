import { computed } from 'vue';

export function useSignInForm(props, emit) {
  const canContinue = computed(() => !props.multipleProviders && !props.emailLinkSent);
  const continueClick = () => (!props.showPasswordField ? emit('check-providers', props.email) : emit('submit'));
  return { canContinue, continueClick };
}
