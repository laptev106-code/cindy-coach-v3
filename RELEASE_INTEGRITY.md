# Release integrity procedure

This candidate uses `CINDY_RELEASE_HASH_V1`, generated and verified from the project root.

## Generate

```sh
python3 scripts/update_release_manifests.py --regression-status PENDING
node tests/run_regression_tests.cjs
python3 scripts/update_release_manifests.py --regression-status PASS --zip-status PENDING
node tests/run_regression_tests.cjs
node tests/run_release_integrity_tests.cjs
```

The generator command is mutating: it writes project-release literals in `coach_core_v3/coach_integration_v3.js`, the cache identity in `service-worker.js`, and both JSON manifests. It does not refresh the two human-readable checksum lists or assemble the ZIP. After each generation, refresh `SHA256SUMS.txt` and `CINDY_V30_COACH_4DAY_PROGRAM_SHA256.txt`, then rerun the generator so `SHA256SUMS.txt` itself is hashed into `artifactHashes`; refresh the cross-reference checksum list after the last manifest write. `node tests/run_regression_tests.cjs` runs gates but does not regenerate these metadata files.

After creating and extracting a draft ZIP, compare every packaged path and file byte-for-byte with the project tree. Then set `--regression-status PASS --zip-status PASS`, refresh both checksum lists, regenerate once more to capture the final `SHA256SUMS.txt` bytes, refresh manifest cross-references, and rerun the full master suite plus the standalone release-integrity suite. Rebuild and byte-compare the delivery ZIP last, after those final manifest writes. If any source, test, process, shell, report, or manifest input changes afterward, regenerate and rerun the suites and archive comparison.

## Hash inputs and normalization

- SHA-256 is used throughout; canonical JSON is UTF-8, recursively key-sorted, compact, with Unicode preserved.
- `runtimeSourcePaths` lists every `.js` file under `coach_core_v3/` and `src/`. The adapter retains `V3_SOURCE_HASH` and `V3_BUILD_HASH` exactly as pinned by the normative Coach core. Separate `V3_RELEASE_SOURCE_HASH` and `V3_RELEASE_BUILD_HASH` literals are replaced with fixed tokens only when calculating outer `releaseSourceHash`; the exact adapter bytes remain in `artifactHashes`.
- `releaseBuildHash` hashes canonical JSON containing the integrity version, `releaseSourceHash`, and exact `index.html`, `manifest.webmanifest`, and `service-worker.js` digests. The pinned core `sourceHash`/`buildHash` are not replaced by project hashes.
- `cacheIdentityHash` hashes canonical JSON containing `releaseSourceHash`, exact `index.html` and `manifest.webmanifest` digests, and the service-worker template hash with only its cache token normalized. The cache name is `cindy-coach-v3-<first 12 cacheIdentityHash hex>-shell`, so runtime-source, HTML, manifest, or service-worker-template changes rotate the shell cache without a self-reference cycle.
- `artifactHashes` covers every runtime source, shell asset, current `tests/*.cjs`, the generator, this procedure document, `SHA256SUMS.txt`, current release notes, Lite behavior notes, the normative V3 specification, and the dated implementation report/diff inventory. `artifactSetHash` is SHA-256 over canonical JSON of that exact path-to-hash map.
- For each JSON manifest only, its `manifestHash` is replaced with the empty string before canonical JSON hashing. The decomposition manifest then pins the exact byte hash of `release-manifest.json`; the reverse reference is omitted to avoid a cycle.
- `SHA256SUMS.txt` is included in `artifactHashes`; the separate `CINDY_V30_COACH_4DAY_PROGRAM_SHA256.txt` lists release-manifest cross-references, so the release-integrity gate checks every listed byte hash directly rather than creating a manifest cycle.
- `tests/run_release_integrity_tests.cjs` recomputes the entire declared path set, all file hashes, both normalized self-hashes, core/project identities, non-cyclic service-worker cache identity, and cross-manifest references. Stage 1 and the master runner execute it.

## Migration safety boundary

The only evidenced V2.8 payload schema is exactly `{ "calibrationRequested": boolean }`. That value is retained in migration metadata and never grants V3 baseline authority. Unknown keys produce the specific `unsupported-v28-fields:<sorted-field-names>` blocker. The exact source bytes and checksum backup remain in storage, no partial migration removes the old key, and Coach remains fail-closed OFF until read-back and receipt verification pass. Rollback verifies `priorV3Checksum` against `priorV3Raw` before any restore write; a mismatch leaves current V3 bytes untouched, returns a recovery failure, and marks a matching receipt failed. No unsupported schema fields are guessed.

## Verification boundary

A master regression PASS applies only to the candidate whose hashes are listed in the manifests. Browser-like VM tests are not real Chromium/WebView, Android, or iOS verification. Package/ZIP verification is not claimed unless a candidate archive is separately assembled and extracted.
