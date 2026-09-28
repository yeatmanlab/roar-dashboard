/**
 * Terminal output for the CLI: @clack/prompts when its dependencies are
 * installed, a styled zero-dependency fallback when they aren't.
 *
 * The fallback is load-bearing, not defensive: `npm run setup` is the command
 * that performs the very `npm install` that makes @clack/prompts available, so
 * its first run must work from a fresh clone with an empty node_modules. Node
 * caches failed module resolutions for the life of the process, so a run that
 * starts on the fallback stays on it — which is why the fallback mirrors the
 * clack look (gutter, glyphs, boxed notes) via node:util's styleText instead
 * of settling for bare console.log lines.
 *
 * ROAR_CLI_PLAIN=1 forces the fallback — an escape hatch for terminals that
 * render the clack prompts poorly.
 */
import readline from 'node:readline/promises';
import { styleText } from 'node:util';

const COLOR_ENABLED = (process.stdout.isTTY || Boolean(process.env.FORCE_COLOR)) && !process.env.NO_COLOR;

/** styleText, gated on TTY/NO_COLOR the way clack gates its own colors. */
function paint(format, text) {
  return COLOR_ENABLED ? styleText(format, text) : text;
}

const BAR = () => paint('gray', '│');

function block(glyph, message) {
  const [first, ...rest] = message.split('\n');
  console.log(BAR());
  console.log(`${glyph}  ${first}`);
  for (const line of rest) console.log(`${BAR()}  ${line}`);
}

function noteBox(body, title) {
  const lines = body.split('\n');
  const width = Math.min(Math.max(...lines.map((l) => l.length), (title ?? '').length + 2) + 2, 76);
  console.log(BAR());
  console.log(
    `${paint('green', '◇')}  ${title ?? ''} ${paint('gray', '─'.repeat(Math.max(width - (title ?? '').length, 1)))}${paint('gray', '╮')}`,
  );
  console.log(`${BAR()} ${' '.repeat(width + 2)}${paint('gray', '│')}`);
  for (const line of lines) {
    console.log(`${BAR()}  ${line}${' '.repeat(Math.max(width - line.length + 1, 1))}${paint('gray', '│')}`);
  }
  console.log(`${BAR()} ${' '.repeat(width + 2)}${paint('gray', '│')}`);
  console.log(`${paint('gray', '├')}${paint('gray', '─'.repeat(width + 3))}${paint('gray', '╯')}`);
}

function fallbackUi() {
  return {
    rich: false,
    intro: (title) => {
      console.log('');
      console.log(`${paint('gray', '┌')}  ${paint(['bgCyan', 'black'], ` ${title} `)}`);
    },
    outro: (message) => {
      console.log(BAR());
      console.log(`${paint('gray', '└')}  ${message}`);
      console.log('');
    },
    step: (message) => block(paint('cyan', '◇'), message),
    info: (message) => block(BAR(), message),
    success: (message) => block(paint('green', '◆'), message),
    warn: (message) => block(paint('yellow', '▲'), message),
    error: (message) => block(paint('red', '■'), message),
    note: (body, title) => noteBox(body, title),
    /**
     * Yes/no prompt. Non-interactive runs (CI, pipes) get `nonTtyValue` so
     * automation is never blocked — the same contract the bash scripts had.
     */
    confirm: async (message, { nonTtyValue }) => {
      if (!process.stdin.isTTY) return nonTtyValue;
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
      try {
        const reply = await rl.question(`${paint('cyan', '◆')}  ${message} [y/N] `);
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
 * Loads the rich UI when possible, the styled fallback otherwise.
 *
 * @returns {Promise<object>} The UI facade described above.
 */
export async function loadUi() {
  if (process.env.ROAR_CLI_PLAIN) return fallbackUi();
  try {
    const [clack, pico] = await Promise.all([import('@clack/prompts'), import('picocolors')]);
    return clackUi(clack, pico.default);
  } catch {
    return fallbackUi();
  }
}
