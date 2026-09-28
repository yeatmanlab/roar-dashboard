/**
 * Terminal output for the CLI: @clack/prompts when its dependencies are
 * installed, a plain console fallback when they aren't.
 *
 * The fallback is load-bearing, not defensive: `npm run setup` is the command
 * that performs the very `npm install` that makes @clack/prompts available, so
 * its first run must work from a fresh clone with an empty node_modules. Every
 * other command runs after setup and gets the rich output.
 */
import readline from 'node:readline/promises';

/** Identity color functions for the plain fallback. */
const noColor = new Proxy({}, { get: () => (s) => s });

function plainUi() {
  const write = (prefix, message) => console.log(prefix ? `${prefix} ${message}` : message);
  return {
    rich: false,
    colors: noColor,
    intro: (title) => write('', `\n=== ${title} ===\n`),
    outro: (message) => write('', `\n${message}\n`),
    step: (message) => write('◇', message),
    info: (message) => write(' ', message),
    success: (message) => write('✓', message),
    warn: (message) => console.warn(`! ${message}`),
    error: (message) => console.error(`✗ ${message}`),
    note: (body, title) => {
      if (title) write('', `\n${title}`);
      for (const line of body.split('\n')) write('', `  ${line}`);
      write('', '');
    },
    /**
     * Yes/no prompt. Non-interactive runs (CI, pipes) get `nonTtyValue` so
     * automation is never blocked — the same contract the bash scripts had.
     */
    confirm: async (message, { nonTtyValue }) => {
      if (!process.stdin.isTTY) return nonTtyValue;
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
      try {
        const reply = await rl.question(`${message} [y/N] `);
        return /^y(es)?$/i.test(reply.trim());
      } finally {
        rl.close();
      }
    },
  };
}

function clackUi(clack, colors) {
  return {
    rich: true,
    colors,
    intro: (title) => clack.intro(colors.inverse(` ${title} `)),
    outro: (message) => clack.outro(message),
    step: (message) => clack.log.step(message),
    info: (message) => clack.log.info(message),
    success: (message) => clack.log.success(message),
    warn: (message) => clack.log.warn(message),
    error: (message) => clack.log.error(message),
    note: (body, title) => clack.note(body, title),
    confirm: async (message, { nonTtyValue }) => {
      if (!process.stdin.isTTY) return nonTtyValue;
      const answer = await clack.confirm({ message, initialValue: false });
      // Ctrl+C during the prompt is a decline, not a crash.
      return clack.isCancel(answer) ? false : answer;
    },
  };
}

/**
 * Loads the rich UI when possible, the plain one otherwise.
 *
 * @returns {Promise<object>} The UI facade described above.
 */
export async function loadUi() {
  try {
    const [clack, pico] = await Promise.all([import('@clack/prompts'), import('picocolors')]);
    return clackUi(clack, pico.default);
  } catch {
    return plainUi();
  }
}
