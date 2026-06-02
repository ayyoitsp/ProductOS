#!/usr/bin/env node
import('../dist/cli/index.js').catch((err) => {
  console.error('productos: failed to start —', err.message);
  console.error('Did you run `npm run build`?');
  process.exit(1);
});
