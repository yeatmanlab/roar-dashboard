# roar-pa

Phonological Awareness (PA) assessment — a 3-AFC jsPsych task.

## How the dashboard resolves this package

The dashboard depends on `@roar-dashboard/roar-pa` via the monorepo workspace.
Because `package.json` sets `"main": "src/index.js"` and `"module": "src/index.js"`,
Vite resolves all imports directly from source at dev time — no compiled output is
needed. The dashboard imports the package in two places:

- `TaskPA.vue` — dynamic `import('@roar-dashboard/roar-pa')` resolves to `src/index.js`
- `TaskPA.vue` — `import '@roar-dashboard/roar-pa/src/experiment/styles/roar.css'` is
  resolved by Vite through the workspace symlink

`dist/` is not used by the dashboard and does not need to be up to date for
`dashboard#dev` to work.

## Why `build` is a no-op

The `build` script intentionally does nothing:

```
"build": "echo 'roar-pa: skipped (Vite uses src directly)'"
```

Because Vite reads `src/index.js` directly, there is no webpack bundle that
the dashboard pipeline needs to produce. Running webpack as part of `turbo build`
would add build time with no benefit — `turbo.json` reflects this by declaring
`"outputs": []` for the `build` task.

## Standalone webpack build

`webpack.config.cjs` still exists for running PA outside the monorepo (e.g., a
standalone hosted build or a development preview that does not use Vite):

```bash
# Start the webpack dev server (hot reload, standalone)
npm run dev

# Produce a standalone production bundle in dist/
npm run build:dev
```

These scripts are independent of the Turbo pipeline and are not invoked during
`dashboard#dev` or `turbo build`.
