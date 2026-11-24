# Bulk issue CSV format

Create a UTF-8 CSV with exactly these required columns:

```csv
"title","body"
"Short issue title","## Description

Explain the work here.

## Tasks

- [ ] First task
- [ ] Second task"
```

Rules:

- The first row must contain `title` and `body` (case-insensitive).
- Every following non-empty row becomes one GitHub issue.
- Both fields are required and cannot be blank.
- Wrap every value in double quotes.
- Preserve Markdown and line breaks inside `body`.
- Escape a literal double quote by doubling it: `""quoted text""`.
- Save as UTF-8 with a `.csv` extension. A UTF-8 BOM is accepted.
- Do not add commentary, code fences, or extra text outside the CSV.

## Prompt for a text-to-CSV agent

```text
Convert the attached TXT file into a UTF-8 CSV for GitHub bulk issue creation.

Output only the CSV file contents. Use exactly two columns in this order: "title","body".
Create one row per distinct issue described in the source text. Give each issue a concise, actionable title. Preserve useful requirements as Markdown in the body. When the source contains tasks or acceptance criteria, format them as GitHub checklists using "- [ ]". Both title and body must be non-empty. Quote every field with double quotes, escape any double quote inside a field by doubling it, and preserve body line breaks inside the quoted field. Do not invent requirements that are absent from the source. Do not include explanations, code fences, or columns other than title and body.
```

