/** Canonical multi-line help texts, shared across commands so wording never drifts. */
export const DOCKER_INSTALL_LINES = [
  'macOS:         brew install --cask docker   (then launch Docker Desktop)',
  'Ubuntu/Debian: curl -fsSL https://get.docker.com | sh',
  '               sudo usermod -aG docker $USER   (then log out/in)',
];

export const DOCKER_DAEMON_LINES = [
  'macOS: launch Docker Desktop and wait for it to finish starting.',
  'Linux: sudo systemctl start docker',
];

export function paramsFileMissingLines() {
  return [
    'taskVariantParameters.json was not found in this directory.',
    "Create it with 'npm run setup', or copy the example yourself from this directory:",
    '  cp taskVariantParameters.example.json taskVariantParameters.json',
  ];
}

export const TEARDOWN_WARNING =
  'This stops the assessment environment and DELETES the local database.\n' +
  'All runs, trials, scores, and uploaded recordings are permanently lost.';

/**
 * True when the args carry an explicit "yes" flag (-y/--yes/--force), used by
 * stop/restart to skip the teardown confirmation.
 *
 * @param {string[]} args
 */
export function hasYesFlag(args) {
  return args.some((a) => a === '-y' || a === '--yes' || a === '--force');
}
