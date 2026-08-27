# scriptc notes

Pinned version: **0.0.35** (exact; no caret, no tilde).

## Classify mismatches — do not paper over

Node vs binary mismatches must be classified (classify mismatches). Do not paper over.

When Node (Vitest) and the native binary disagree, classify the mismatch as one of:

- limitation
- misuse
- framework bug
- flag upstream

Do not paper over labs behavior. Do not silently add `--dynamic` to make a test green.

## Compiler-dynamic embedding

Note: compiler-dynamic embedding is not a core API. `--dynamic` is an app-edge hatch, not a framework contract. Core and examples must stay 100% static. If a call needs `--dynamic`, remove it or document it as an app-edge hatch.

## SC* log

Record unexpected `SC*` codes here as they appear. Empty until the first classified code.

| Code | Seen in | Classification | Notes |
| ---- | ------- | -------------- | ----- |
