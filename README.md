# Issue Desk

A browser-based tracker configured for `Poiixen/senior_design`. It loads the repository automatically, filters and searches issues, assigns a local triage status, and exports the current view to CSV or Markdown.

CSV exports include each ticket's full description (the GitHub issue body), preserving Markdown and line breaks. Tickets without a description have an empty description cell.

The **Files & upload** tab creates issues in bulk from a UTF-8 CSV. It previews and validates every row before sending anything, creates issues sequentially, shows each result, and can retry failed rows without repeating successful ones. Creating issues uses the GitHub connection configured in **Settings** with **Issues: read and write** access.

The **Settings** tab connects GitHub using a fine-grained personal access token, verifies the account, and lists repositories available to the token (including private repositories it can access). Choose a repository or enter `owner/repository`, then click **Use repository** to load it for issues and CSV uploads. The repository choice is saved on this device. Tokens stay only in memory, are shared by issue loading and uploading, and are cleared on disconnect or page reload. Disconnect clears local access; revoke the token on GitHub to invalidate it elsewhere.

Create a token at [GitHub token settings](https://github.com/settings/personal-access-tokens/new), select the appropriate resource owner and repositories, and grant **Issues: read-only** for viewing or **Issues: read and write** for imports. Organization approval may be required. Repository discovery uses [GitHub's authenticated repositories endpoint](https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user). This static app uses token authentication; OAuth sign-in would require a registered GitHub app and backend to complete [GitHub's authorization flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

See [CSV_FORMAT.md](CSV_FORMAT.md) for the exact file contract, a reusable text-to-CSV agent prompt, and [issue-import-template.csv](issue-import-template.csv) for a ready-to-copy example.

## Use locally

Serve the `dist` directory with any static web server, then open `index.html`. Public repositories work without authentication. Connect in Settings to load private repositories with Issues read access. Reconnect after reloading the page.

The GitHub issues endpoint also returns pull requests, so Issue Desk hides them by default. Turn off **Hide pull requests** to include them. GitHub API pagination is handled in 100-item pages, up to 1,000 items per load.
