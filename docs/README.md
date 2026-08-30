# Docs

Product docs have **one source**. The website will publish this tree (plus the root README intro). It will not be a second book.

| Path                                   | On the site?                                 |
| -------------------------------------- | -------------------------------------------- |
| [`guide/`](guide/)                     | Yes — this is what users read                |
| [`scriptc-notes.md`](scriptc-notes.md) | No — contributor log for scriptc `SC*` codes |

When you change a public export from `@nodum/core` or `@nodum/cli`, update `guide/` in the same PR. Code samples must match a file the repo can run (`e2e/fixtures/`, later `examples/`).
