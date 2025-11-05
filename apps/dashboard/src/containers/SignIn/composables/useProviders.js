export function useProviders(available) {
  const all = Array.isArray(available) ? available : [];
  const showGenericProviders = all.includes('google');
  const showScopedProviders = ['clever', 'classlink', 'nycps'].some((p) => all.includes(p));
  return { showGenericProviders, showScopedProviders };
}
