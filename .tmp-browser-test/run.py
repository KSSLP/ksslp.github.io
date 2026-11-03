import json, subprocess, time, urllib.request

NODE = r"C:\Users\KSYGS\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
URL = "http://127.0.0.1:8765/photo.html"
PORT = 9334

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
edge = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", f"--remote-debugging-port={PORT}",
                         r"--user-data-dir=C:\Users\KSYGS\Desktop\ksslp.github.io-main\.tmp-browser-test\profile",
                         "--no-first-run", "--no-default-browser-check", "about:blank"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def page_ws():
    for _ in range(80):
        try:
            targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
            pages = [t["webSocketDebuggerUrl"] for t in targets if t.get("type") == "page"]
            if pages:
                return pages[0]
        except Exception:
            pass
        time.sleep(0.3)
    raise SystemExit("devtools not available")


ws = page_ws()

script = r"""
const url = process.argv[2];
const wsUrl = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  const logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Log.entryAdded") logs.push(m.params.entry.level + ": " + m.params.entry.text);
    if (m.method === "Runtime.exceptionThrown") logs.push("EXCEPTION: " + JSON.stringify(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description));
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return "EXC: " + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description);
    return r.result && r.result.result ? r.result.result.value : r;
  };
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable"); await send("Network.enable");
  await send("Network.emulateNetworkConditions", { offline: false, latency: 120, downloadThroughput: 400 * 1024, uploadThroughput: 400 * 1024 });
  await send("Page.navigate", { url });
  await sleep(1500);
  console.log("QUESTION:", await evaluate("document.getElementById('question-title').innerText"));
  await evaluate("document.getElementById('password-input').value='cxz'; document.getElementById('submit-btn').click(); 1");
  await sleep(200);
  console.log("UNLOCKED:", await evaluate("document.getElementById('content-section').classList.contains('active')"));
  const fs = require("fs");
  const timeline = [];
  for (let t = 0; t < 60; t++) {
    const s = await evaluate("JSON.stringify({page: document.getElementById('page-input').value, total: document.getElementById('total-pages').textContent, items: document.getElementById('gallery-container').children.length, imgs: document.getElementById('gallery-container').querySelectorAll('img').length, ph: document.getElementById('gallery-container').querySelectorAll('.photo-placeholder').length, nextDisabled: document.getElementById('next-btn').disabled, loadingShown: document.getElementById('loading-more').style.display})");
    timeline.push((t * 0.5).toFixed(1) + "s " + s);
    if (t === 1 || t === 4 || t === 9 || t === 59) {
      const img = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync("C:\\Users\\KSYGS\\Desktop\\ksslp.github.io-main\\.tmp-browser-test\\shot" + t + ".png", Buffer.from(img.result.data, "base64"));
    }
    await sleep(500);
  }
  console.log(timeline.join("\n"));
  console.log("LOGS:", logs.join(" | ").slice(0, 3000));
  ws.close(); process.exit(0);
})();
"""

path = r"C:\Users\KSYGS\Desktop\ksslp.github.io-main\.tmp-browser-test\cdp_test.js"
open(path, "w", encoding="utf-8").write(script)
out = subprocess.run([NODE, path, URL, ws], capture_output=True, text=True, encoding="utf-8", timeout=180)
print(out.stdout)
print(out.stderr[-3000:])
edge.terminate()
