# website

The Nodum docs site. It publishes [`../docs/guide`](../docs/guide) as-is: edit the guide, not this folder.

```bash
pnpm --filter nodum-website start   # local preview
pnpm docs:build                     # what CI runs on every PR
```

`main` deploys to GitHub Pages at https://vilancer.github.io/nodum/ (`.github/workflows/docs.yml`).
