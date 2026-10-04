import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
// esbuild's Windows service protocol can interpret a `\xNN` path segment as an
// escape sequence. POSIX separators keep unusual but valid checkout names stable.
const portable = value => value.replaceAll('\\', '/');

await build({
  entryPoints: [portable(path.join(root, 'server.ts'))],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  outfile: portable(path.join(root, 'dist', 'server.cjs'))
});
