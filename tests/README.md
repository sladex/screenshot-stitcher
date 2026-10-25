# Stitching tests

Run from the project root (Node.js, no dependencies to install):

```sh
node --test tests/stitch.test.cjs
```

- `stitch.test.cjs` — synthetic algorithm tests and regression tests for four real screenshot sequences.
- `samples/` — source PNGs grouped by example. Each folder contains source screenshots (`Screenshot_*.png`), sorted by filename, and the expected result (`stitched.png`) used for pixel-by-pixel comparison.
- `helpers/png.cjs` — reads the sample PNGs using built-in Node.js APIs. Tests load the sources directly from `samples/` and compare every output pixel at full resolution with `stitched.png`. No additional copies need to be prepared.

Examples:

| Folder | Scenario | Expected size |
|---|---|---|
| `samples/1-three-header-same/` | Three screenshots, identical header, short overlap | 1080 × 4656 |
| `samples/2-three-header-diff/` | Three screenshots, status bar changes, short overlap | 1080 × 4656 |
| `samples/3-two-header-diff/` | Two screenshots, status bar changes | 1080 × 2835 |
| `samples/4-two-header-same/` | Two screenshots, identical header | 1080 × 2694 |
