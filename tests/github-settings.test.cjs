const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// A small DOM fixture keeps authentication tests dependency-free and offline.
function setup() {
  const elements = new Map(), calls = [], replies = [];
  class Element {
    constructor() { this.value = ''; this.textContent = ''; this.type = 'password'; this.disabled = false; this.listeners = {}; this.attributes = {}; this.children = []; this.dataset = {}; this.classes = new Set(); this.classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) }; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute(name, value) { this.attributes[name] = value; }
    replaceChildren(...children) { this.children = children; this.value = ''; }
    focus() { this.focused = true; }
    close() { this.closed = true; }
    async fire(name) { await this.listeners[name]?.({ preventDefault() {}, target: this }); }
  }
  const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  for (const [, id] of html.matchAll(/id="([^"]+)"/g)) elements.set(id, Object.assign(new Element(), { id }));
  const get = id => { assert.ok(elements.has(id), `Missing element: ${id}`); return elements.get(id); };
  const tabs = ['issuesView', 'filesView', 'settingsView'].map(id => Object.assign(new Element(), { dataset: { view: id } }));
  const links = [new Element(), new Element()];
  const document = {
    getElementById: get,
    querySelectorAll: selector => selector === '.tab' ? tabs : selector === '.view' ? ['issuesView', 'filesView', 'settingsView'].map(get) : selector === '[data-open-settings]' ? links : []
  };
  const context = vm.createContext({ document, window: {}, Option: function(text, value) { this.text = text; this.value = value; },
    fetch: async (url, options) => {
      calls.push({ url, options });
      assert.ok(replies.length, `Unexpected request: ${url}`);
      const reply = replies.shift();
      if (typeof reply === 'function') return reply();
      return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist/github-settings.js'), 'utf8'), context);
  const respond = (body, status = 200) => replies.push({ body, status });
  async function connect(repositories = []) {
    get('githubToken').value = 'test-token';
    respond({ login: 'octocat' }); respond(repositories);
    await get('githubConnectForm').fire('submit');
  }
  return { get, calls, replies, respond, connect, access: context.window.githubAccess, tabs, links };
}

test('Settings tab, gear, and upload link open the settings view', async () => {
  const s = setup();
  await s.tabs[2].fire('click');
  assert.equal(s.get('settingsView').hidden, false);
  assert.equal(s.get('issuesView').hidden, true);
  await s.tabs[0].fire('click'); await s.get('settingsBtn').fire('click');
  assert.equal(s.get('settingsView').hidden, false);
  await s.links[0].fire('click');
  assert.equal(s.get('connectDialog').closed, true);
  assert.equal(s.get('githubToken').focused, true);
});

test('public requests omit authorization; uploads require a connection', async () => {
  const s = setup(); s.respond([]);
  await s.access.request('/repos/owner/repo/issues');
  assert.equal(s.calls[0].options.headers.Authorization, undefined);
  await assert.rejects(s.access.request('/repos/owner/repo/issues', { method: 'POST' }, true), /Connect GitHub in Settings/);
  assert.equal(s.calls.length, 1);
});

test('connect validates account, lists private repositories, and shares authentication', async () => {
  const s = setup(); await s.connect([{ full_name: 'owner/private', private: true }]);
  assert.equal(s.access.isConnected(), true);
  assert.match(s.get('githubStatus').textContent, /@octocat/);
  assert.equal(s.get('githubToken').value, '');
  assert.equal(s.get('githubRepoSelect').children[1].text, 'owner/private (private)');
  s.respond([]); await s.access.request('/repos/owner/private/issues');
  s.respond({ html_url: 'https://github.com/owner/private/issues/1' });
  await s.access.request('/repos/owner/private/issues', { method: 'POST', body: '{"title":"Example"}' }, true);
  assert.ok(s.calls.every(call => call.options.headers.Authorization === 'Bearer test-token'));
  assert.equal(s.calls[3].options.headers['Content-Type'], 'application/json');
});

test('repository discovery paginates and safely handles repository names as text', async () => {
  const s = setup(); s.get('githubToken').value = 'test-token';
  s.respond({ login: 'octocat' });
  s.respond(Array.from({ length: 100 }, (_, index) => ({ full_name: `owner/repo-${index}` })));
  s.respond([{ full_name: 'owner/<script>', private: true }]);
  await s.get('githubConnectForm').fire('submit');
  assert.equal(s.calls.length, 3);
  assert.match(s.calls[2].url, /page=2/);
  assert.equal(s.get('githubRepoSelect').children.length, 102);
  assert.match(s.get('repositoryStatus').textContent, /101 accessible repositories/);
});

test('invalid replacement keeps working access and reports validation error', async () => {
  const s = setup(); await s.connect();
  s.get('githubToken').value = 'bad-token'; s.respond({ message: 'Bad credentials' }, 401);
  await s.get('githubConnectForm').fire('submit');
  assert.equal(s.access.isConnected(), true);
  assert.match(s.get('githubError').textContent, /rejected this token/);
  assert.equal(s.get('githubConnectBtn').disabled, false);
  s.respond([]); await s.access.request('/repos/owner/repo/issues');
  assert.equal(s.calls.at(-1).options.headers.Authorization, 'Bearer test-token');
});

test('expired active tokens clear connection and require reconnection', async () => {
  const s = setup(); await s.connect(); s.respond({}, 401);
  await assert.rejects(s.access.request('/repos/owner/repo/issues'), /expired/);
  assert.equal(s.access.isConnected(), false);
  assert.equal(s.get('githubDisconnectBtn').disabled, true);
  assert.equal(s.get('githubRepoSelect').disabled, true);
});

test('repository permissions errors retain connection and permit manual entry', async () => {
  const s = setup(); s.get('githubToken').value = 'test-token';
  s.respond({ login: 'octocat' }); s.respond({}, 403);
  await s.get('githubConnectForm').fire('submit');
  assert.equal(s.access.isConnected(), true);
  assert.match(s.get('repositoryStatus').textContent, /Could not list repositories/);
  assert.equal(s.get('refreshReposBtn').disabled, false);
});

test('disconnect clears token, masks input, resets repositories, and blocks future writes', async () => {
  const s = setup(); await s.connect([{ full_name: 'owner/private' }]);
  s.get('githubToken').value = 'another-token'; await s.get('toggleToken').fire('click');
  assert.equal(s.get('githubToken').type, 'text');
  await s.get('githubDisconnectBtn').fire('click');
  assert.equal(s.access.isConnected(), false);
  assert.equal(s.get('githubToken').value, '');
  assert.equal(s.get('githubToken').type, 'password');
  assert.equal(s.get('githubRepoSelect').children.length, 1);
  await assert.rejects(s.access.request('/repos/owner/repo/issues', { method: 'POST' }, true), /Connect GitHub/);
  s.respond([]); await s.access.request('/repos/owner/repo/issues');
  assert.equal(s.calls.at(-1).options.headers.Authorization, undefined);
});

test('disconnect ignores stale repository discovery responses', async () => {
  const s = setup(); await s.connect(); let finish;
  s.replies.push(() => new Promise(resolve => { finish = resolve; }));
  const pending = s.get('refreshReposBtn').fire('click');
  await s.get('githubDisconnectBtn').fire('click');
  finish({ ok: true, json: async () => [{ full_name: 'owner/private' }] }); await pending;
  assert.equal(s.get('githubRepoSelect').children.length, 1);
  assert.equal(s.get('githubRepoSelect').disabled, true);
});

test('completed writes remain successful when disconnected during the request', async () => {
  const s = setup(); await s.connect(); let finish;
  s.replies.push(() => new Promise(resolve => { finish = resolve; }));
  const pending = s.access.request('/repos/owner/repo/issues', { method: 'POST', body: '{}' }, true);
  await s.get('githubDisconnectBtn').fire('click');
  finish({ ok: true, json: async () => ({ number: 42 }) });
  assert.equal((await pending).number, 42);
});

test('selecting a repository fills the settings form; loaded repository syncs upload destination', async () => {
  const s = setup(); s.get('githubRepoSelect').value = 'owner/private';
  await s.get('githubRepoSelect').fire('change');
  assert.equal(s.get('settingsRepoInput').value, 'owner/private');
  s.access.setRepository('owner/private');
  assert.equal(s.get('uploadRepo').value, 'owner/private');
  assert.equal(s.get('repoInput').value, 'owner/private');
});
