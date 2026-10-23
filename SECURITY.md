# Security policy

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/macopc/PicWiz/security/advisories/new) for suspected security issues. Sign in to GitHub to submit the report. Do not disclose exploit details in public issues, pull requests or discussions.

Include:

- The affected commit or version, browser/OS and whether you used a local or hosted build.
- The affected behavior, expected security boundary and potential impact.
- Minimal reproduction steps using synthetic images or other non-sensitive sample data.
- A suggested fix, if you have one.

Keep screenshots, local-storage contents, recovery backups, clipboard data, personal information and credentials out of the report unless essential and safely sanitized. Coordinate any public disclosure through the private advisory. If the private form is unavailable, do not post exploit details publicly; a private channel must be available first.

## Scope

PicWiz currently implements V2. Screenshots, annotations, presets and batch contents are processed in the browser; accounts and cloud synchronization described in V3 documents are not implemented. Unexpected disclosure, network transfer, unsafe file handling or execution of untrusted content may be security issues even in a local-only app.

Include the exact commit so the report can be assessed against current code. Older snapshots have no separate maintenance commitment. [V2 validation](docs/v2/validation.md) records tested behavior and known limits; it is not a security audit.

For ordinary bugs and usage questions, follow [SUPPORT.md](SUPPORT.md). For abuse or harassment on GitHub, follow the [code of conduct](CODE_OF_CONDUCT.md).
