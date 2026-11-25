const fs = require('fs');
const vm = require('vm');
const s = fs.readFileSync('yskbl.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0, errs = 0;
while ((m = re.exec(s))) {
  i++;
  if (!m[1].trim()) continue;
  try { new vm.Script(m[1], { filename: 'yskbl#script' + i }); }
  catch (e) { errs++; console.log('  ✗ script', i, e.message); }
}
console.log('语法错误', errs, '| 乱码', (s.match(/\uFFFD/g) || []).length);

// 检查遗留引用
for (const k of ['settingsOn', '_first', 'silentError', 'forceFull', 'marks', 'STREAM_GROW', 'job.phase']) {
  const c = (s.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(String(c).padStart(3), k);
}
