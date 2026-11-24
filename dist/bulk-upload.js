(() => {
  let rows = [];
  const get = id => document.getElementById(id);
  const escape = value => {
    const node = document.createElement('div');
    node.textContent = value ?? '';
    return node.innerHTML;
  };

  function parseCsv(text) {
    const records = [];
    let record = [], field = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { record.push(field); field = ''; }
      else if (char === '\n') { record.push(field.replace(/\r$/, '')); records.push(record); record = []; field = ''; }
      else field += char;
    }
    if (quoted) throw new Error('The CSV has an unclosed quoted field.');
    if (field || record.length) { record.push(field.replace(/\r$/, '')); records.push(record); }
    const nonempty = records.filter(item => item.some(value => value.trim()));
    if (!nonempty.length) throw new Error('The CSV is empty.');
    const headers = nonempty.shift().map(value => value.trim().toLowerCase());
    if (!headers.includes('title') || !headers.includes('body')) throw new Error('CSV must contain title and body columns.');
    const titleIndex = headers.indexOf('title'), bodyIndex = headers.indexOf('body');
    return nonempty.map((item, index) => ({
      title: (item[titleIndex] || '').trim(), body: item[bodyIndex] || '', status: 'ready', error: '', index: index + 1
    }));
  }

  function renderRows() {
    get('uploadCount').textContent = `${rows.length} row${rows.length === 1 ? '' : 's'}`;
    get('uploadRows').innerHTML = rows.length ? rows.map(row => `<tr><td>${row.index}</td><td>${escape(row.title)}</td><td>${escape(row.body)}</td><td><span class="status ${row.status}">${escape(row.error || row.status)}</span>${row.url ? `<br><a href="${escape(row.url)}" target="_blank" rel="noopener">view</a>` : ''}</td></tr>`).join('') : '<tr><td colspan="4" class="preview-empty">Select a CSV to preview it here.</td></tr>';
  }

  async function loadFile(file) {
    get('uploadError').textContent = '';
    try {
      if (!file || !file.name.toLowerCase().endsWith('.csv')) throw new Error('Choose a .csv file.');
      rows = parseCsv(await file.text());
      const invalid = rows.filter(row => !row.title || !row.body.trim());
      if (invalid.length) throw new Error(`Rows ${invalid.map(row => row.index).join(', ')} need both a title and body.`);
      get('fileMessage').textContent = `${file.name} · ${rows.length} valid row${rows.length === 1 ? '' : 's'}`;
      get('createIssuesBtn').disabled = !rows.length;
      get('retryIssuesBtn').hidden = true;
      renderRows();
    } catch (error) {
      rows = []; renderRows(); get('createIssuesBtn').disabled = true;
      get('fileMessage').textContent = 'File could not be loaded.';
      get('uploadError').textContent = error.message;
    }
  }

  get('csvFile').addEventListener('change', event => loadFile(event.target.files[0]));
  ['dragenter', 'dragover'].forEach(type => get('dropZone').addEventListener(type, event => { event.preventDefault(); get('dropZone').classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(type => get('dropZone').addEventListener(type, event => { event.preventDefault(); get('dropZone').classList.remove('dragging'); }));
  get('dropZone').addEventListener('drop', event => loadFile(event.dataTransfer.files[0]));

  async function createIssue(row, repository) {
    row.status = 'creating'; row.error = ''; renderRows();
    const result = await window.githubAccess.request(`/repos/${repository.split('/').map(encodeURIComponent).join('/')}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title: row.title, body: row.body })
    }, true);
    row.status = 'created'; row.url = result.html_url;
  }

  async function runImport(failedOnly = false) {
    const repository = get('uploadRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    const targets = rows.filter(row => failedOnly ? row.status === 'failed' : row.status !== 'created');
    get('uploadError').textContent = '';
    if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) { get('uploadError').textContent = 'Use repository format owner/repository.'; return; }
    if (!window.githubAccess.isConnected()) { get('uploadError').textContent = 'Connect GitHub in Settings with Issues write access first.'; return; }
    get('createIssuesBtn').disabled = true; get('retryIssuesBtn').hidden = true;
    for (const row of targets) {
      try { await createIssue(row, repository); }
      catch (error) { row.status = 'failed'; row.error = error.message; }
      renderRows();
    }
    const failures = rows.filter(row => row.status === 'failed').length;
    get('retryIssuesBtn').hidden = !failures;
    get('createIssuesBtn').disabled = rows.every(row => row.status === 'created');
    get('uploadError').textContent = failures ? `${failures} row${failures === 1 ? '' : 's'} failed. Fix access or repository details, then retry.` : `Created ${targets.length} issue${targets.length === 1 ? '' : 's'} successfully.`;
  }

  get('createIssuesBtn').addEventListener('click', () => runImport(false));
  get('retryIssuesBtn').addEventListener('click', () => runImport(true));
})();
