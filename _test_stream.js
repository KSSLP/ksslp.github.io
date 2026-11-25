// 真实后端跑一遍分片算法：验证并发上限、分片覆盖、拼接正确性
const https = require('https');
const url = 'https://btzx2027class3.dpdns.org/yskbl/' + encodeURIComponent('1.绝望来临.mp4');

const SPARK_CHUNKS = 16;
const SPARK_CONCURRENCY = 5;

let inflight = 0, maxInflight = 0;

function get(start, end) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const r = https.request({
      hostname: u.hostname, path: u.pathname, method: 'GET',
      headers: { Range: `bytes=${start}-${end}` },
      rejectUnauthorized: false, timeout: 30000,
    }, rs => {
      const bufs = [];
      rs.on('data', c => bufs.push(c));
      rs.on('end', () => res({ status: rs.statusCode, buf: Buffer.concat(bufs) }));
    });
    r.on('error', rej);
    r.on('timeout', () => r.destroy(new Error('timeout')));
    r.end();
  });
}

function head() {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const r = https.request({
      hostname: u.hostname, path: u.pathname, method: 'HEAD',
      rejectUnauthorized: false, timeout: 20000,
    }, rs => res({ status: rs.statusCode, headers: rs.headers }));
    r.on('error', rej);
    r.on('timeout', () => r.destroy(new Error('timeout')));
    r.end();
  });
}

(async () => {
  const t0 = Date.now();
  const h = await head();
  const total = parseInt(h.headers['content-length'], 10);
  console.log('总大小:', total, '| accept-ranges:', h.headers['accept-ranges']);

  const n = SPARK_CHUNKS;
  const base = Math.floor(total / n);
  const chunks = [];
  for (let i = 0; i < n; i++) {
    const s = i * base;
    const e = i === n - 1 ? total - 1 : s + base - 1;
    if (s <= e) chunks.push({ index: i, start: s, end: e, len: e - s + 1 });
  }
  console.log('分片数:', chunks.length, '| 每片约', base, '字节');
  console.log('首片:', chunks[0].start, '-', chunks[0].end, '| 末片:', chunks[15].start, '-', chunks[15].end);

  const results = new Array(chunks.length);
  let cursor = 0, done = 0, got = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const c = chunks[cursor++];
      inflight++; maxInflight = Math.max(maxInflight, inflight);
      try {
        const r = await get(c.start, c.end);
        if (r.status !== 206) throw new Error('status ' + r.status);
        if (r.buf.length !== c.len) throw new Error(`len ${r.buf.length}/${c.len}`);
        results[c.index] = r.buf;
        done++; got += c.len;
      } finally { inflight--; }
    }
  }
  const pool = [];
  for (let i = 0; i < SPARK_CONCURRENCY; i++) pool.push(worker());
  await Promise.all(pool);

  const merged = Buffer.concat(results);
  console.log(`\n下载完成: ${done}/${chunks.length} 片, ${got}/${total} 字节, 用时 ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log('最大并发:', maxInflight, '(上限应为 5)');
  console.log('拼接后大小:', merged.length, merged.length === total ? '✓ 与原始一致' : '✗ 不一致');

  // 抽验拼接内容与原文件是否一致（下载整包对比，只比前 2MB 省流量）
  const whole = await new Promise((res, rej) => {
    const u = new URL(url);
    const r = https.request({
      hostname: u.hostname, path: u.pathname, method: 'GET',
      headers: { Range: 'bytes=0-2097151' },
      rejectUnauthorized: false, timeout: 30000,
    }, rs => {
      const bufs = [];
      rs.on('data', c => bufs.push(c));
      rs.on('end', () => res(Buffer.concat(bufs)));
    });
    r.on('error', rej); r.end();
  });
  console.log('前 2MB 内容比对:', merged.subarray(0, whole.length).equals(whole) ? '✓ 完全一致' : '✗ 有差异');
})().catch(e => console.log('ERR', e.message));
