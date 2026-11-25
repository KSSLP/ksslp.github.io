// 单独测试栅格写入逻辑
const ms = 1 << 20;
const total = 25882668;
const N = 16, base = Math.floor(total / N);
const chunks = [];
for (let i = 0; i < N; i++) {
  const s = i * base;
  const e = i === N - 1 ? total - 1 : s + base - 1;
  if (s <= e) chunks.push({ index: i, start: s, end: e, len: e - s + 1 });
}
console.log('块数', chunks.length, 'block0', chunks[0].start, chunks[0].end);
console.log('block1', chunks[1].start, chunks[1].end);

// 模拟 block0 下载完成后的栅格写入
const c = chunks[0];
const len = c.end - c.start + 1;
const buf = new Uint8Array(len);
for (let i = 0; i < len; i++) buf[i] = (c.start + i) & 0xff;

const grid = new Map();
let off = 0;
for (let p = c.start; p <= c.end;) {
  const g = Math.floor(p / ms);
  const gEnd = Math.min(c.end, (g + 1) * ms - 1);
  const l = gEnd - p + 1;
  grid.set(g, buf.subarray(off, off + l));
  off += l;
  p = gEnd + 1;
}
console.log('写入栅格:', [...grid.keys()], '各格长度:', [...grid.values()].map(v => v.byteLength));

// 拼接
const endMs = Math.floor(c.end / ms) + 1;
console.log('endMs =', endMs, '→ 应拼', endMs * ms, '字节，但实际只有', len);
const parts = [];
let remain = total;
for (let i = 0; i < endMs; i++) {
  const b = grid.get(i);
  if (!b) { parts.push(new Uint8Array(0)); continue; }
  const take = Math.min(b.byteLength, remain);
  parts.push(take === b.byteLength ? b : b.subarray(0, take));
  remain -= take;
}
const sizes = parts.map(p => p.byteLength);
console.log('拼接各段:', sizes, '总长', sizes.reduce((a, b) => a + b, 0), '期望', len);
