const fs = require('fs');
const vm = require('vm');
for (const f of ['index.html', 'yskbl.html']) {
  const s = fs.readFileSync(f, 'utf8');
  const bad = (s.match(/\uFFFD/g) || []).length;
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, i = 0, errs = 0;
  while ((m = re.exec(s))) {
    i++;
    if (!m[1].trim()) continue;
    try { new vm.Script(m[1], { filename: f + '#script' + i }); }
    catch (e) { errs++; console.log('  ✗', f, 'script', i, e.message); }
  }
  console.log(f.padEnd(12), 'script', i, '段, 语法错误', errs, '| 乱码', bad, '| 行数', s.split('\n').length);
}
