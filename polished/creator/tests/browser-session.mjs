// Isolated headless Edge fallback when the desktop browser runtime cannot start.
// Start Edge with --headless=new --remote-debugging-port=9337 and a temporary profile.
import fs from 'node:fs/promises';
export async function connect() {
  const tabs = await (await fetch('http://127.0.0.1:9337/json/list')).json();
  const tab = tabs.find(tab => tab.type === 'page' && tab.url.includes('/polished/creator/')) || tabs.find(tab => tab.type === 'page' && tab.url === 'about:blank');
  if (!tab) throw new Error('Open about:blank in the isolated QA browser first.');
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const p = pending.get(data.id); pending.delete(data.id);
      if (data.error) p.reject(new Error(data.error.message)); else p.resolve(data.result);
    } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails);
    else if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Page.bringToFront');
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async (expression, timeout = 15000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 120)); }
    throw new Error(`Timed out: ${expression}`);
  };
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, ...extra });
  const click = async selector => {
    const rect = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw Error('Missing '+${JSON.stringify(selector)}); el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await mouse('mousePressed', rect.x, rect.y, { button: 'left', clickCount: 1 });
    await mouse('mouseReleased', rect.x, rect.y, { button: 'left', clickCount: 1 });
  };
  const screenshot = async file => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(file, Buffer.from(shot.data, 'base64')); };
  return { send, evaluate, wait, mouse, click, screenshot, errors, close: () => socket.close() };
}


