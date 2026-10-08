// Makes sure public/data/ has data before the site builds or runs.
//
// The real pipeline (`fyj build`) writes public/data/groups.json, groups/, vocab.json and
// manifest.json. When that output is there, it wins and nothing is touched. When it is not, the
// made up sample data in fixtures/data/ is copied in, so the site always builds. The sample
// manifest says `"fixture": true`, and the site shows a "Sample data" banner when it sees that.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public', 'data');
const source = path.join(root, 'fixtures', 'data');

if (fs.existsSync(path.join(target, 'groups.json'))) {
  let note = 'real pipeline output';
  try {
    const m = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
    if (m.fixture === true) note = 'sample data left from an earlier run';
  } catch {
    // no manifest or unreadable: say nothing more
  }
  console.log(`prepare-data: public/data/groups.json found (${note}), leaving it alone.`);
} else {
  if (!fs.existsSync(path.join(source, 'groups.json'))) {
    console.error('prepare-data: no public/data/groups.json and no fixtures/data/groups.json. Run "npm run fixtures" or "fyj build".');
    process.exit(1);
  }
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  console.log('prepare-data: no pipeline output found, copied sample data from fixtures/data/ into public/data/.');
}
