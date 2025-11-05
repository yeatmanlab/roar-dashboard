export function useAuth(emit) {
  return {
    submit: () => emit('submit'),
    forgot: () => emit('forgot-password'),
    magicLink: () => emit('magic-link'),
    backToPassword: () => emit('back-to-password'),
  };
}
