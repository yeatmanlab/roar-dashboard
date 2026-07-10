// The app consumes a single constant from the source repo's `@roav-ran/shared-config`
// package, which is not migrated into the monorepo — it stays with the cloud-functions
// manager repo. Rather than re-package that workspace dependency for one value, the
// constant is vendored here, unchanged. The package's other exports (audio/model blob
// prefixes) were the legacy firekit upload-path contract, now owned by the assessment
// SDK, so they are intentionally not carried over.
export const TRIAL_TYPE_TEST = 'Test';
