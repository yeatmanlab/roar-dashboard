/**
 * Terminal output for the CLI.
 *
 * One renderer draws everything — gutter, glyphs, boxes, collapsing task
 * tails — with node:util's styleText, so the CLI needs no dependencies to
 * print (load-bearing: `npm run setup` runs before its own `npm install` has
 * made any package available). @clack/prompts is used for exactly one thing
 * it does better than a readline fallback: the interactive confirm prompt.
 *
 * Glyph semantics follow clack's prompt language: ◆ marks the item currently
 * being worked on, ◇ marks a completed one, ▲ warns, ■ is an error.
 *
 * ROAR_CLI_PLAIN=1 skips clack (readline confirm instead). ROAR_CLI_VERBOSE=1
 * streams subtask output instead of collapsing it on success.
 */
import readline from 'node:readline/promises';
import { styleText } from 'node:util';

/** ROAR_CLI_VERBOSE=1 streams subtask output instead of collapsing it. */
const VERBOSE = Boolean(process.env.ROAR_CLI_VERBOSE);
const IS_TTY = process.stdout.isTTY === true;
const COLOR_ENABLED = (IS_TTY || Boolean(process.env.FORCE_COLOR)) && !process.env.NO_COLOR;

/** styleText, gated on TTY/NO_COLOR the way clack gates its own colors. */
function paint(format, text) {
  return COLOR_ENABLED ? styleText(format, text) : text;
}

const BAR = () => paint('gray', '│');
/** Length of a string as rendered — ANSI color codes excluded. */
// eslint-disable-next-line no-control-regex -- matching the ESC byte is the point
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
// eslint-disable-next-line no-control-regex -- matching the ESC byte is the point
const HAS_ANSI = /\x1b/;
const visibleLength = (s) => s.replace(ANSI_PATTERN, '').length;
const GLYPH = {
  active: () => paint('cyan', '◆'),
  done: () => paint('green', '◇'),
  info: () => paint('blue', '●'),
  warn: () => paint('yellow', '▲'),
  error: () => paint('red', '■'),
};

/** Bolds a leading step counter ("[4/5] …") so the sequence scans at a glance. */
function emphasizeStepPrefix(message) {
  return message.replace(/^(\[\d+\/\d+\])/, (m) => paint('bold', m));
}

function block(glyph, message) {
  const [first, ...rest] = message.split('\n');
  console.log(BAR());
  console.log(`${glyph}  ${first}`);
  for (const line of rest) console.log(`${BAR()}  ${line}`);
}

/**
 * A titled box in the gutter. The kind's glyph leads the title line, so a
 * warning and its remedy are one visual unit rather than two stacked blocks.
 */
// Box content width: up to 96 columns on wide terminals (long connection
// strings fit unwrapped), never past the terminal edge, never below 60.
const BOX_MAX_WIDTH = Math.max(60, Math.min(96, (process.stdout.columns ?? 80) - 6));

/** Word-wraps one logical line to the box's content width, keeping its indent. */
function wrapLine(line, max) {
  if (line.length <= max) return [line];
  const indent = line.match(/^ */)[0];
  const words = line.trimStart().split(' ');
  const out = [];
  let current = indent;
  for (const word of words) {
    if (current.length > indent.length && current.length + 1 + word.length > max) {
      out.push(current);
      current = indent + word;
    } else {
      current = current.length > indent.length ? `${current} ${word}` : indent + word;
    }
    // An unbreakable token (a long URL) can exceed the width on its own —
    // hard-split it rather than overflowing the frame.
    while (current.length > max) {
      out.push(current.slice(0, max));
      current = indent + current.slice(max);
    }
  }
  if (current.length > indent.length) out.push(current);
  return out;
}

function noteBox(body, title, kind) {
  // Styled lines (they carry ANSI codes) are measured by visible length and
  // never word-wrapped — splitting inside an escape sequence would corrupt it.
  const lines = body.split('\n').flatMap((l) => (HAS_ANSI.test(l) ? [l] : wrapLine(l, BOX_MAX_WIDTH - 2)));
  const heading = title ?? '';
  // Body lines wrap at the cap, but the title is one line by construction —
  // the box grows to fit it rather than letting it overflow the frame.
  const width = Math.max(
    Math.min(Math.max(...lines.map(visibleLength)) + 2, BOX_MAX_WIDTH),
    Math.min(heading.length + 3, 100),
  );
  console.log(BAR());
  console.log(
    `${GLYPH[kind]()}  ${paint('bold', heading)} ${paint('gray', '─'.repeat(Math.max(width - heading.length, 1)))}${paint('gray', '╮')}`,
  );
  console.log(`${BAR()} ${' '.repeat(width + 2)}${paint('gray', '│')}`);
  for (const line of lines) {
    console.log(`${BAR()}  ${line}${' '.repeat(Math.max(width - visibleLength(line) + 1, 1))}${paint('gray', '│')}`);
  }
  console.log(`${BAR()} ${' '.repeat(width + 2)}${paint('gray', '│')}`);
  console.log(`${paint('gray', '├')}${paint('gray', '─'.repeat(width + 3))}${paint('gray', '╯')}`);
}

/**
 * A collapsing subtask: heading now, a live tail of the output while running
 * (TTY only), one completion line when done. On failure the full retained
 * output is printed above the error line; ROAR_CLI_VERBOSE=1 keeps the
 * stream on success too. Tail lines are truncated to the terminal width so
 * the erase accounting can never be thrown off by wrapping.
 */
function makeTask(title) {
  block(GLYPH.active(), title);
  const TAIL_LIMIT = 8;
  const all = [];
  const tail = [];
  let printed = 0;

  const erase = () => {
    if (printed > 0) process.stdout.write(`[${printed}A[0J`);
    printed = 0;
  };
  const renderTail = () => {
    erase();
    const cap = Math.max((process.stdout.columns ?? 80) - 6, 20);
    for (const text of tail) {
      console.log(`${BAR()}  ${paint('gray', text.length > cap ? `${text.slice(0, cap - 1)}…` : text)}`);
    }
    printed = tail.length;
  };

  return {
    line: (text) => {
      all.push(text);
      if (VERBOSE) {
        console.log(`${BAR()}  ${paint('gray', text)}`);
        return;
      }
      if (!IS_TTY) return;
      tail.push(text);
      if (tail.length > TAIL_LIMIT) tail.shift();
      renderTail();
    },
    done: (message) => {
      if (!VERBOSE) erase();
      block(GLYPH.done(), message);
    },
    fail: (message) => {
      if (!VERBOSE) {
        erase();
        for (const text of all) console.log(`${BAR()}  ${paint('gray', text)}`);
      }
      block(GLYPH.error(), message);
    },
  };
}

async function loadConfirm() {
  if (!process.env.ROAR_CLI_PLAIN) {
    try {
      const clack = await import('@clack/prompts');
      return async (message, initialValue) => {
        const answer = await clack.confirm({ message, initialValue });
        // Ctrl+C during the prompt is treated as the safe default.
        return clack.isCancel(answer) ? initialValue : answer;
      };
    } catch {
      // Fresh clone — fall through to the readline prompt.
    }
  }
  return async (message, initialValue) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    try {
      const reply = await rl.question(`${GLYPH.active()}  ${message} ${initialValue ? '[Y/n]' : '[y/N]'} `);
      if (reply.trim() === '') return initialValue;
      return /^y(es)?$/i.test(reply.trim());
    } finally {
      rl.close();
    }
  };
}

/**
 * Builds the UI facade.
 *
 * @returns {Promise<object>}
 */
export async function loadUi() {
  const confirmImpl = await loadConfirm();
  return {
    intro: (title) => {
      console.log('');
      console.log(`${paint('gray', '┌')}  ${paint(['bgCyan', 'black'], ` ${title} `)}`);
    },
    outro: (message) => {
      console.log(BAR());
      console.log(`${paint('gray', '└')}  ${message}`);
      console.log('');
    },
    step: (message) => block(GLYPH.active(), emphasizeStepPrefix(message)),
    info: (message) => block(GLYPH.info(), message),
    success: (message) => block(GLYPH.done(), message),
    warn: (message) => block(GLYPH.warn(), message),
    error: (message) => block(GLYPH.error(), message),
    /**
     * A titled box; `kind` picks the title glyph: 'info' (default), 'warn',
     * 'error', or 'done'.
     */
    note: (body, title, kind = 'info') => noteBox(body, title, kind),
    task: (title) => makeTask(emphasizeStepPrefix(title)),
    /** Bold emphasis for a fragment inside note bodies or messages. */
    strong: (text) => paint('bold', text),
    /**
     * A raw line inside the gutter — for long-running child output (the dev
     * server) that should stay visible, unlike a task's collapsing tail. The
     * text may carry its own ANSI colors.
     */
    stream: (text) => console.log(`${BAR()}  ${text}`),
    /**
     * Yes/no prompt. Non-interactive runs (CI, pipes) get `nonTtyValue` so
     * automation is never blocked — the same contract the bash scripts had.
     */
    confirm: async (message, { nonTtyValue, initialValue = false }) => {
      if (!process.stdin.isTTY) return nonTtyValue;
      return confirmImpl(message, initialValue);
    },
  };
}
