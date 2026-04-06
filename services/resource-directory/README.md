# Resource Directory Service

Current status: `M1 completed`.

This package is no longer an M0 placeholder. It now serves as the M1 resource
directory ingestion library and CLI host for:

- CFC Active parsing/import
- Island Harvest parsing/import
- merge and geocoding helpers
- resource query repository logic

Current command split:

- `pnpm resources:import:cfc`
- `pnpm resources:import:island-harvest`
- `pnpm resources:sync`
- `pnpm test:live-sources` for manual / opt-in real-source smoke

Important verification note:

- default CI does **not** run live-source smoke
- default CI now relies on real API smoke via `pnpm test:smoke:real`
- formal `M1` closeout evidence lives in [`docs/22_M1_Closeout.md`](/Users/kairan/Documents/Spring26/WeaveNYC/docs/22_M1_Closeout.md)
