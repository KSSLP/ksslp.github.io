// 桩环境：验证分片下载 + 换源 + 错误处理逻辑
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('yskbl.html', 'utf8');
const m0 = html.match(/document\.addEventListener\('DOMContentLoaded',[\s\S]*?\n        \}\);\n    <\/script>/);
if (!m0) { console.log('切片失败'); process.exit(1); }
const src = m0[0].replace(/\n    <\/script>$/, '');
console.log('切片末尾:', JSON.stringify(src.slice(-60)));

function el(id) {
  return {
    id, hidden: false, textContent: '', innerHTML: '', className: '', style: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    _h: {}, addEventListener(e, f) { (this._h[e] = this._h[e] || []).push(f); },
    appendChild(c) { (this._kids = this._kids || []).push(c); },
    querySelector() { return this.id === 'episodes-container' ? ep1 : null; },
    querySelectorAll() { return []; },
    get src() { return this._src || ''; }, set src(v) { this._src = v; },
    currentTime: 0, paused: true, load() {}, play() { return Promise.resolve(); },
    _src: '',
  };
}
const ep1 = el('button');
const els = {};
['episodes-container', 'video-player', 'error-overlay', 'error-text', 'video-title-area',
 'video-title-text', 'dl-bar', 'dl-bar-fill', 'dl-bar-text', 'dl-bar-speed'].forEach(i => els[i] = el(i));

// 模拟 fetch：HEAD + 16 段
const TOTAL = 25882668;
const N = 16, base = Math.floor(TOTAL / N);
let requests = [];
global.fetch = async (url, opt) => {
  const method = (opt && opt.method) || 'GET';
  if (String(url).includes('list.json')) {
    console.log('[fetch] list.json');
    return { ok: true, json: async () => ['1.绝望来临.mp4'], status: 200 };
  }
  if (method === 'HEAD') {
    console.log('[fetch] HEAD', String(url).slice(-30));
    return { ok: true, headers: { get: k => ({ 'content-length': String(TOTAL), 'accept-ranges': 'bytes', 'content-type': 'video/mp4' }[k] || null) } };
  }
  const rng = opt.headers.Range.match(/bytes=(\d+)-(\d+)/);
  const s = +rng[1], e = +rng[2];
  requests.push([s, e]);
  const len = e - s + 1;
  const ab = new ArrayBuffer(len);
  // 用可辨识的内容填充，便于校验顺序
  const u8 = new Uint8Array(ab);
  for (let i = 0; i < len; i++) u8[i] = (s + i) & 0xff;
  return { status: 206, arrayBuffer: async () => ab };
};

const blobs = [];
global.Blob = class {
  constructor(parts) {
    this.parts = parts;
    this.size = parts.reduce((a, p) => a + (p.byteLength || 0), 0);
    // 拼一份完整副本用于校验
    const out = new Uint8Array(this.size);
    let o = 0;
    for (const p of parts) { const v = p instanceof Uint8Array ? p : new Uint8Array(p); out.set(v, o); o += v.length; }
    global.__lastBlob = out;
    blobs.push(this.size);
  }
};
let urlN = 0;
global.URL = { createObjectURL: () => 'blob:fake-' + (++urlN), revokeObjectURL: () => {} };
global.performance = { now: () => Date.now() };
global.AbortController = class { constructor() { this.signal = {}; } abort() {} };
global.setTimeout = setTimeout;
global.window = global;

const ctx = vm.createContext({
  console, fetch: global.fetch, Blob: global.Blob, URL: global.URL,
  performance: global.performance, AbortController: global.AbortController,
  setTimeout: global.setTimeout, Math, JSON, Map, Set, Promise, Array,
  document: {
    getElementById: id => els[id] || null,
    addEventListener: (e, f) => { if (e === 'DOMContentLoaded') { global.__ready = f; } },
    createElement: (t) => el(t),
    querySelectorAll: () => [],
  },
  navigator: { userAgent: 'test' },
});
ctx.window = ctx;

(async () => {
  try {
  vm.runInContext(src, ctx);
  console.log('src 切片长度:', src.length, '| 含 startStream:', /function startStream/.test(src), '| 含 loadEpisode:', /function loadEpisode/.test(src));
  await global.__ready();
  console.log('DOMContentLoaded 已执行');
  // fetchVideoList 是异步的，等一轮
  await new Promise(r => setTimeout(r, 200));
  console.log('requests 数:', requests.length, '| 进度文本:', els['dl-bar-text'].textContent);
  console.log('video src:', els['video-player'].src);

  // 等下载跑完
  const t0 = Date.now();
  while (requests.length < N && Date.now() - t0 < 10000) {
    await new Promise(r => setTimeout(r, 50));
  }
  await new Promise(r => setTimeout(r, 300));

  console.log('=== 分片请求 ===');
  console.log('请求数:', requests.length);
  const covered = requests.slice().sort((a, b) => a[0] - b[0])
    .reduce((acc, [s, e]) => acc + (e - s + 1), 0);
  console.log('覆盖字节:', covered, covered === TOTAL ? '✓ 无重叠无遗漏' : '✗');
  console.log('首片范围:', requests[0][0], '-', requests[0][1]);

  console.log('\n=== Blob 重建次数 ===');
  console.log('重建了几次源:', blobs.length, '(重建越多，换源打断播放越频繁)');
  console.log('最后一次大小:', blobs[blobs.length - 1], blobs[blobs.length - 1] === TOTAL ? '✓ 完整' : '✗ 应为 ' + TOTAL);
  const last = global.__lastBlob;
  if (last) {
    let bad = -1;
    for (let i = 0; i < last.byteLength; i++) {
      if (last[i] !== (i & 0xff)) { bad = i; break; }
    }
    console.log('内容逐字节校验:', bad === -1 ? '✓ 顺序正确' : '✗ 第 ' + bad + ' 字节错乱（应为 ' + (bad & 0xff) + '，实际 ' + last[bad] + '）');
  }
  // 打印每次重建的大小
  console.log('每次重建大小:', blobs.join(' → '));

  console.log('\n=== 进度条 ===');
  console.log('进度文本:', els['dl-bar-text'].textContent);
  console.log('进度条 class:', [...els['dl-bar'].classList._s].join(' '));

  console.log('\n=== 错误提示 ===');
  console.log('error-overlay 显示状态:', els['error-overlay'].style.display);
  console.log('是否误报"内容缺失":', els['video-player'].style.display === 'none' ? '✗ 误报了' : '✓ 没有误报');
  } catch (e) {
    console.log('!!! 异常:', e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e);
  }
})();
