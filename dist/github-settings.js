(() => {
  const get = id => document.getElementById(id);
  let token = '', login = '', revision = 0, repoRequest = 0;

  function showView(id) {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === id);
      tab.setAttribute('aria-current', tab.dataset.view === id ? 'page' : 'false');
    });
    document.querySelectorAll('.view').forEach(view => { view.hidden = view.id !== id; });
  }
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.view)));
  document.querySelectorAll('[data-open-settings]').forEach(button => button.addEventListener('click', () => {
    get('connectDialog').close();
    showView('settingsView');
    get('githubToken').focus();
  }));
  get('settingsBtn').addEventListener('click', () => showView('settingsView'));

  function updateConnection() {
    get('githubStatus').textContent = token ? `Connected as @${login}. Access is limited by your token's permissions.` : 'Not connected. Public repositories can be loaded without a token.';
    get('githubStatus').classList.toggle('connected', !!token);
    get('githubDisconnectBtn').disabled = !token;
    get('refreshReposBtn').disabled = !token;
    get('uploadAccess').textContent = token ? `Using the GitHub connection for @${login}. Creating issues requires Issues: read and write for this repository.` : 'Connect GitHub in Settings to create issues.';
    get('githubConnectBtn').textContent = token ? 'Update connection' : 'Connect GitHub';
  }
  function resetConnection() {
    revision++; repoRequest++; token = ''; login = '';
    get('githubToken').value = '';
    get('githubToken').type = 'password';
    get('toggleToken').textContent = 'Show';
    get('toggleToken').setAttribute('aria-pressed', 'false');
    get('githubRepoSelect').replaceChildren(new Option('Connect GitHub to browse repositories', ''));
    get('githubRepoSelect').disabled = true;
    get('repositoryStatus').textContent = 'You can also enter a public repository below.';
    get('githubConnectBtn').disabled = false;
    updateConnection();
  }
  async function api(path, options = {}, accessToken = token) {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && accessToken && accessToken === token) resetConnection();
      const message = response.status === 401 ? 'GitHub rejected this token. It may be invalid, expired, or revoked. Reconnect in Settings.'
        : response.status === 403 ? 'GitHub denied access. Check token permissions, organization approval, and API rate limits.'
        : response.status === 404 ? 'Repository not found or not accessible. Check its name and the repositories allowed by your token.'
        : result.message || `GitHub returned ${response.status}`;
      throw new Error(message);
    }
    return result;
  }
  window.githubAccess = Object.freeze({
    showSettings: () => showView('settingsView'),
    showIssues: () => showView('issuesView'),
    isConnected: () => !!token,
    request: async (path, options = {}, requireAuth = false) => {
      if (!path.startsWith('/repos/')) throw new Error('Unsupported GitHub API path.');
      if (requireAuth && !token) throw new Error('Connect GitHub in Settings with Issues write access first.');
      const current = revision;
      const result = await api(path, options);
      // A completed write must remain successful even if access changed while it ran.
      if (current !== revision && (!options.method || options.method === 'GET')) throw new Error('GitHub connection changed. Please try again.');
      return result;
    },
    setRepository: repository => {
      get('settingsRepoInput').value = repository;
      get('uploadRepo').value = repository;
      get('repoInput').value = repository;
      get('githubRepoSelect').value = repository;
    }
  });

  async function loadRepositories() {
    const current = revision, request = ++repoRequest;
    get('refreshReposBtn').disabled = true;
    get('githubRepoSelect').disabled = true;
    get('repositoryStatus').textContent = 'Loading repositories from GitHub…';
    try {
      const repositories = [];
      for (let page = 1; ; page++) {
        const batch = await api(`/user/repos?per_page=100&page=${page}&sort=updated`);
        if (current !== revision || request !== repoRequest) return;
        repositories.push(...batch);
        if (batch.length < 100) break;
      }
      const unique = [...new Map(repositories.map(repository => [repository.full_name, repository])).values()];
      unique.sort((a, b) => a.full_name.localeCompare(b.full_name));
      get('githubRepoSelect').replaceChildren(new Option('Choose a repository', ''), ...unique.map(repository => new Option(`${repository.full_name}${repository.private ? ' (private)' : ''}`, repository.full_name)));
      get('githubRepoSelect').value = get('settingsRepoInput').value;
      get('githubRepoSelect').disabled = !unique.length;
      get('repositoryStatus').textContent = `${unique.length} accessible repositor${unique.length === 1 ? 'y' : 'ies'}. Missing a repository? Check the token's resource owner, repository selection, and organization approval.`;
    } catch (error) {
      if (current === revision && request === repoRequest) {
        get('repositoryStatus').textContent = `Could not list repositories. ${error.message} You can enter a repository below.`;
      }
    } finally {
      if (current === revision && request === repoRequest) get('refreshReposBtn').disabled = !token;
    }
  }
  get('githubConnectForm').addEventListener('submit', async event => {
    event.preventDefault();
    const candidate = get('githubToken').value.trim();
    if (!candidate) { get('githubError').textContent = 'Enter a GitHub token first.'; return; }
    const current = ++revision;
    repoRequest++;
    get('githubError').textContent = '';
    get('githubConnectBtn').disabled = true;
    get('githubConnectBtn').textContent = 'Connecting…';
    try {
      const user = await api('/user', {}, candidate);
      if (current !== revision) return;
      token = candidate; login = user.login;
      get('githubToken').value = '';
      get('githubToken').type = 'password';
      get('toggleToken').textContent = 'Show';
      get('toggleToken').setAttribute('aria-pressed', 'false');
      updateConnection();
      await loadRepositories();
    } catch (error) {
      if (current === revision) get('githubError').textContent = error.message;
    } finally {
      // An invalid replacement leaves the previous working connection intact.
      if (current === revision) { get('githubConnectBtn').disabled = false; updateConnection(); }
    }
  });
  get('githubDisconnectBtn').addEventListener('click', () => { resetConnection(); get('githubError').textContent = ''; });
  get('refreshReposBtn').addEventListener('click', loadRepositories);
  get('githubRepoSelect').addEventListener('change', event => {
    if (event.target.value) get('settingsRepoInput').value = event.target.value;
  });
  get('toggleToken').addEventListener('click', () => {
    const visible = get('githubToken').type === 'password';
    get('githubToken').type = visible ? 'text' : 'password';
    get('toggleToken').textContent = visible ? 'Hide' : 'Show';
    get('toggleToken').setAttribute('aria-pressed', String(visible));
  });
  updateConnection();
})();
