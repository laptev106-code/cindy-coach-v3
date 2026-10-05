const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const output = execFileSync(process.execPath, [path.join(__dirname, 'run_real_post_test_browser_lifecycle.cjs')], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, CINDY_TEST_PACE_GUIDANCE_FREEZE: '1' }
});
assert(output.includes('PACE_GUIDANCE_COACH_FREEZE_PASS'), 'real Coach pace-guidance lifecycle marker missing');
process.stdout.write(output);
console.log('PACE_GUIDANCE_COACH_FREEZE_TESTS_PASS');
