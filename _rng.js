const https = require('https');
const url = 'https://btzx2027class3.dpdns.org/yskbl/' + encodeURIComponent('1.绝望来临.mp4');

function head(method, headers) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const r = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers, rejectUnauthorized: false, timeout: 20000,
    }, rs => {
      let n = 0;
      rs.on('data', c => { n += c.length; if (n > 0 && method === 'GET') { r.destroy(); } });
      rs.on('end', () => res({ status: rs.statusCode, headers: rs.headers, got: n }));
      rs.on('close', () => res({ status: rs.statusCode, headers: rs.headers, got: n }));
    });
    r.on('error', e => { if (e.code === 'ECONNRESET') return; rej(e); });
    r.on('timeout', () => r.destroy(new Error('timeout')));
    r.end();
  });
}

(async () => {
  const h = await head('HEAD', {});
  console.log('=== HEAD ===');
  console.log('status', h.status);
  console.log('accept-ranges:', h.headers['accept-ranges']);
  console.log('content-length:', h.headers['content-length']);
  console.log('content-type:', h.headers['content-type']);
  console.log('access-control-allow-origin:', h.headers['access-control-allow-origin']);
  console.log('access-control-expose-headers:', h.headers['access-control-expose-headers']);
  console.log('server:', h.headers['server'], '| cf-cache:', h.headers['cf-cache-status']);

  console.log('\n=== GET Range: bytes=0-1023 ===');
  const g = await head('GET', { Range: 'bytes=0-1023' });
  console.log('status', g.status);
  console.log('content-range:', g.headers['content-range']);
  console.log('content-length:', g.headers['content-length']);
  console.log('accept-ranges:', g.headers['accept-ranges']);
  console.log('cors:', g.headers['access-control-allow-origin']);
  console.log('实际收到字节:', g.got);
})().catch(e => console.log('ERR', e.message));
