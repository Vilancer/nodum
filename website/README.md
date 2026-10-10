# website

The Nodum docs site. It publishes [`../docs/guide`](../docs/guide) as-is: edit the guide, not this folder.
When you add a guide page, add it to `sidebars.mjs` too (the order is explicit).

```bash
pnpm --filter nodum-website start   # local preview
pnpm docs:build                     # what CI runs on every PR
```

`main` deploys to GitHub Pages at https://vilancer.github.io/nodum/ (`.github/workflows/docs.yml`).
