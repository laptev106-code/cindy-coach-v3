#!/usr/bin/env python3
"""Generate reproducible CINDY release/decomposition integrity manifests.

Usage from the project root:
  python3 scripts/update_release_manifests.py [--regression-status PENDING|PASS]

The Coach adapter retains the core-pinned source/build identifiers required by
the normative core and embeds separate project-release identifiers. To avoid a
cryptographic self-reference, only the two project-release 64-hex literals are
replaced with fixed tokens when calculating releaseSourceHash; exact adapter
bytes are still included in artifactHashes. Manifest self-hashes normalize only
their own manifestHash field to the empty string. All other declared artifact
hashes are SHA-256 over exact file bytes.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTEGRITY_VERSION = "CINDY_RELEASE_HASH_V1"
MASTER_GATES = 25
ADAPTER = "coach_core_v3/coach_integration_v3.js"
RUNTIME_SOURCE_PATHS = sorted(
    path.relative_to(ROOT).as_posix()
    for base in (ROOT / "coach_core_v3", ROOT / "src")
    for path in base.rglob("*.js")
    if path.is_file()
)
SHELL_PATHS = ["index.html", "manifest.webmanifest", "service-worker.js"]


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha_file(relative: str) -> str:
    return sha_bytes((ROOT / relative).read_bytes())


def core_identity() -> tuple[str, str]:
    source = (ROOT / "coach_core_v3/coach_core_v3.js").read_text(encoding="utf-8")
    build_match = re.search(r"const EXPECTED_BUILD_HASH = '([0-9a-f]{64})';", source)
    source_match = re.search(r"const EXPECTED_SOURCE_HASH = '([0-9a-f]{64})';", source)
    if not build_match or not source_match:
        raise SystemExit("normative core identity constants were not found")
    return source_match.group(1), build_match.group(1)


def sync_adapter_core_identity() -> tuple[str, str]:
    source_hash, build_hash = core_identity()
    path = ROOT / ADAPTER
    data = path.read_bytes()
    data, source_count = re.subn(rb"(const V3_SOURCE_HASH = ')[0-9a-f]{64}(';)", lambda m: m.group(1) + source_hash.encode("ascii") + m.group(2), data)
    data, build_count = re.subn(rb"(const V3_BUILD_HASH = ')[0-9a-f]{64}(';)", lambda m: m.group(1) + build_hash.encode("ascii") + m.group(2), data)
    if source_count != 1 or build_count != 1:
        raise SystemExit("adapter core-identity anchors must each occur exactly once")
    path.write_bytes(data)
    return source_hash, build_hash


def normalized_runtime_bytes(relative: str) -> bytes:
    data = (ROOT / relative).read_bytes()
    if relative == ADAPTER:
        data, a = re.subn(rb"(const V3_RELEASE_SOURCE_HASH = ')[0-9a-f]{64}(';)", rb"\1<PROJECT_RELEASE_SOURCE_HASH>\2", data)
        data, b = re.subn(rb"(const V3_RELEASE_BUILD_HASH = ')[0-9a-f]{64}(';)", rb"\1<PROJECT_RELEASE_BUILD_HASH>\2", data)
        if a != 1 or b != 1:
            raise SystemExit("adapter project-release normalization anchors must each occur exactly once")
    return data


def normalized_source_map() -> dict[str, str]:
    return {path: sha_bytes(normalized_runtime_bytes(path)) for path in RUNTIME_SOURCE_PATHS}


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalized_manifest_hash(value: dict) -> str:
    candidate = dict(value)
    candidate["manifestHash"] = ""
    return sha_bytes(canonical(candidate))


def generate(regression_status: str, zip_status: str) -> None:
    coach_source_hash, coach_build_hash = sync_adapter_core_identity()
    source_map = normalized_source_map()
    source_hash = sha_bytes(canonical(source_map))

    sw_template = """const CACHE_NAME = 'cindy-coach-v3-<CACHE_ID>-shell';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
"""
    cache_identity_hash = sha_bytes(canonical({
        "integrityVersion": INTEGRITY_VERSION,
        "runtimeSourceHash": source_hash,
        "shellArtifactHashes": {
            "index.html": sha_file("index.html"),
            "manifest.webmanifest": sha_file("manifest.webmanifest"),
        },
        "serviceWorkerTemplateHash": sha_bytes(sw_template.encode("utf-8")),
    }))
    sw = sw_template.replace("<CACHE_ID>", cache_identity_hash[:12])
    (ROOT / "service-worker.js").write_text(sw, encoding="utf-8")

    shell_hashes = {path: sha_file(path) for path in SHELL_PATHS}
    build_hash = sha_bytes(canonical({
        "integrityVersion": INTEGRITY_VERSION,
        "runtimeSourceHash": source_hash,
        "shellArtifactHashes": shell_hashes,
    }))

    adapter_path = ROOT / ADAPTER
    adapter = adapter_path.read_bytes()
    adapter, source_count = re.subn(rb"(const V3_RELEASE_SOURCE_HASH = ')[0-9a-f]{64}(';)", lambda m: m.group(1) + source_hash.encode("ascii") + m.group(2), adapter)
    adapter, build_count = re.subn(rb"(const V3_RELEASE_BUILD_HASH = ')[0-9a-f]{64}(';)", lambda m: m.group(1) + build_hash.encode("ascii") + m.group(2), adapter)
    if source_count != 1 or build_count != 1:
        raise SystemExit("adapter project-release identity anchors must each occur exactly once")
    adapter_path.write_bytes(adapter)

    test_paths = sorted(f"tests/{entry.name}" for entry in (ROOT / "tests").iterdir() if entry.is_file() and entry.suffix == ".cjs")
    verification_paths = sorted(test_paths + ["scripts/update_release_manifests.py", "RELEASE_INTEGRITY.md", "RELEASE_README.md", "RELEASE_NOTES.md", "SHA256SUMS.txt", "CINDY_LITE_V1_RELEASE_NOTES.md", "CINDY_Adaptive_Coach_V3.0.0_NORMATIVE_SPECIFICATION.md", "CINDY_V30_PACE_GUIDANCE_BASELINE_VALIDATION_FIX_REPORT_20261004.md", "CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md", "CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md"])
    artifact_paths = sorted(set(RUNTIME_SOURCE_PATHS + SHELL_PATHS + verification_paths))
    artifact_hashes = {path: sha_file(path) for path in artifact_paths}
    artifact_set_hash = sha_bytes(canonical(artifact_hashes))

    release_path = ROOT / "release-manifest.json"
    release = json.loads(release_path.read_text(encoding="utf-8"))
    acceptance_status = "PASS (102/102); pinned core fixtureCorpusVersion remains v3.0.0-100." if regression_status == "PASS" else "PENDING — run the 102-case normative acceptance corpus on this exact candidate."
    release.update({
        "releaseCandidateId": "CINDY_V3_ADAPTIVE_COACH_IMPLEMENTATION_20261004",
        "releaseTrack": "cindy-v3-adaptive-coach",
        "hardeningDate": "2026-10-04",
        "hardeningStatus": "Implementation candidate; not deployed or published.",
        "integrityVersion": INTEGRITY_VERSION,
        "integrityProcedure": {
            "command": "python3 scripts/update_release_manifests.py --regression-status PASS --zip-status PASS",
            "hashAlgorithm": "SHA-256",
            "canonicalJson": "UTF-8 JSON; recursively sorted object keys; compact separators; Unicode preserved.",
            "runtimeSourceInput": "SHA-256 by path over runtimeSourcePaths; only adapter V3_RELEASE_SOURCE_HASH/V3_RELEASE_BUILD_HASH literals are normalized to fixed tokens for this source-set digest.",
            "embeddedAdapterIdentity": "V3_SOURCE_HASH/V3_BUILD_HASH match the normative core-pinned expected identity; V3_RELEASE_SOURCE_HASH/V3_RELEASE_BUILD_HASH match releaseSourceHash/releaseBuildHash.",
            "buildHashInput": "SHA-256 canonical JSON of integrityVersion, runtimeSourceHash, and exact index.html/manifest.webmanifest/service-worker.js hashes.",
            "artifactSetHashInput": "SHA-256 canonical JSON of artifactHashes (exact file-byte SHA-256 values).",
            "manifestSelfHashNormalization": "For each JSON manifest, replace only its own manifestHash field with the empty string before canonical JSON SHA-256.",
            "serviceWorkerCacheIdentity": "cindy-coach-v3-<first 12 hex chars of cacheIdentityHash>-shell; cacheIdentityHash covers releaseSourceHash, exact index.html and manifest.webmanifest hashes, and the normalized service-worker template (excluding only its cache token) to avoid a hash cycle.",
            "migrationSchema": "Only {calibrationRequested: boolean} is substantiated for V2.8; unsupported fields preserve the old key and report unsupported-v28-fields:<sorted-field-names>.",
        },
        "runtimeSourcePaths": RUNTIME_SOURCE_PATHS,
        "verificationArtifactPaths": verification_paths,
        "artifactHashes": artifact_hashes,
        "artifactSetHash": artifact_set_hash,
        "cacheIdentityHash": cache_identity_hash,
        "sourceHash": coach_source_hash,
        "buildHash": coach_build_hash,
        "coachCoreSourceHash": coach_source_hash,
        "coachCoreBuildHash": coach_build_hash,
        "releaseSourceHash": source_hash,
        "releaseBuildHash": build_hash,
        "indexHash": shell_hashes["index.html"],
        "webManifestHash": shell_hashes["manifest.webmanifest"],
        "serviceWorkerHash": shell_hashes["service-worker.js"],
        "coachCoreHash": artifact_hashes["coach_core_v3/coach_core_v3.js"],
        "coachIntegrationHash": artifact_hashes[ADAPTER],
        "coachApplicationServiceHash": artifact_hashes["src/application/coach/coach_application_service_v3.js"],
        "coachStateMigrationHash": artifact_hashes["src/infrastructure/storage/coach_state_migration_v3.js"],
        "historyProvenanceHash": artifact_hashes["src/domain/history/history_provenance_v3.js"],
        "sessionContractHash": artifact_hashes["src/domain/workout/session_contract_v3.js"],
        "coachStateRepositoryHash": artifact_hashes["src/infrastructure/storage/coach_state_repository_v3.js"],
        "bootstrapHash": artifact_hashes["src/composition/bootstrap_v3.js"],
        "programPackHash": artifact_hashes["coach_core_v3/program_pack_v3.js"],
        "programServiceHash": artifact_hashes["src/application/program/program_service_v3.js"],
        "programMetaRepositoryHash": artifact_hashes["src/infrastructure/storage/program_meta_repository_v3.js"],
        "masterRegressionGates": MASTER_GATES,
        "masterRegressionStatus": f"PASS ({MASTER_GATES}/{MASTER_GATES})" if regression_status == "PASS" else f"PENDING — run the {MASTER_GATES}-gate master regression on this exact candidate.",
        "v3AcceptanceStatus": acceptance_status,
        "v3AcceptanceFixtureCount": 102,
        "realBrowserVerification": "Author-run Chromium DOM interactions on localhost with a disposable profile: PASS; Plan verifies one shared exercise surface, nested direction-labelled arrows and disabled boundaries. This is not independent QA; WebView, Android and iOS NOT_VERIFIED.",
        "finalZipVerification": "PASS — final source ZIP members verified byte-for-byte against the project tree." if zip_status == "PASS" else "PENDING — build the final source ZIP and compare every member byte-for-byte with the project tree.",
        "coachEnabledDefault": True,
        "coachColdStartStatus": "ACTIVE — fresh default ON; baseline authority requires a fresh explicit user request.",
        "baselineTestProtocol": "ACTIVE — fixed standard Cindy time-only test at 5/10/20 minutes; default 10; no user-configured composition or rounds; successful exact completion establishes the Coach starting workout.",
        "knownImplementationBlockers": [
            "V2.8 schema is only evidenced for the exact boolean field calibrationRequested; any other key yields unsupported-v28-fields:<sorted-field-names>, with old data and verified backup retained and Coach fail-closed OFF.",
            "Legacy false Coach preference without explicit user-choice provenance cannot be distinguished from a Lite-forced false; it resolves to default ON as approved.",
            "No normative trainingExperience enum exists; the editor keeps the supported descriptive string rather than inventing enum values.",
            "Independent QA follow-up and native Android/iOS/WebView validation remain outstanding; ZIP member verification is a separate author-run integrity check.",
        ],
        "implementationPolicy": [
            "Lite build marker affects presentation only; Coach runtime default is ON unless an explicit user preference or global fail-closed gate applies.",
            "OFF is a global runtime and lifecycle barrier; Coach-owned sessions already started retain their frozen WorkoutSpec and provenance and complete passively without post-OFF Coach state/actions.",
            "Pending unstarted baseline/intervention intents are closed durably and never auto-resume on ON.",
            "Manual workout records and History remain user-owned; canonical edits/deletions/clear invalidate Coach evidence, not user records.",
            "Plan paceGuidance is passed through CoachInput.config and frozen as combined-mode session runtime metadata; explicit false and manual behavior are regression-checked, with no new WorkoutSpec field or CoachCore adaptation rule.",
            "Canonical baseline validity is rechecked before public derive/start; an invalid same-ID BASELINE History row is excluded before CoachCore and stale baseline ID/authority are cleared.",
        ],
        "notes": "Implementation candidate for CINDY Adaptive Coach V3; no deployment/publication performed. See CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md and CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md for this UX pass, exact file scope, outcomes, limits, and independent-QA handoff.",
    })
    # Core identity remains pinned to the exact V3 normative engine contract; project hashes are separate.
    release["manifestHash"] = ""
    release["manifestHash"] = normalized_manifest_hash(release)
    write_json(release_path, release)

    decomp_path = ROOT / "decomposition-manifest.json"
    decomp = json.loads(decomp_path.read_text(encoding="utf-8"))
    status = f"PASS ({MASTER_GATES}/{MASTER_GATES})" if regression_status == "PASS" else f"PENDING ({MASTER_GATES} gates)"
    decomp.update({
        "decompositionVersion": "stage-8-coach-preference-migration-history-release-integrity-r1",
        "currentCoreHash": artifact_hashes["coach_core_v3/coach_core_v3.js"],
        "coachCoreHash": artifact_hashes["coach_core_v3/coach_core_v3.js"],
        "currentIntegrationHash": artifact_hashes[ADAPTER],
        "coachApplicationServiceHash": artifact_hashes["src/application/coach/coach_application_service_v3.js"],
        "programPackHash": artifact_hashes["coach_core_v3/program_pack_v3.js"],
        "programServiceHash": artifact_hashes["src/application/program/program_service_v3.js"],
        "programMetaRepositoryHash": artifact_hashes["src/infrastructure/storage/program_meta_repository_v3.js"],
        "bootstrapHash": artifact_hashes["src/composition/bootstrap_v3.js"],
        "indexHash": shell_hashes["index.html"],
        "serviceWorkerHash": shell_hashes["service-worker.js"],
        "releaseManifestHash": sha_file("release-manifest.json"),
        "releaseArtifactSetHash": artifact_set_hash,
        "releaseBuildHash": build_hash,
        "releaseSourceHash": source_hash,
        "manifestHash": "",
        "coachStateRepositoryHash": artifact_hashes["src/infrastructure/storage/coach_state_repository_v3.js"],
        "historyProvenanceHash": artifact_hashes["src/domain/history/history_provenance_v3.js"],
        "masterRegressionGates": MASTER_GATES,
        "stage7Tests": {
            **decomp.get("stage7Tests", {}),
            "masterRegression": status,
            "v3Acceptance": acceptance_status,
            "paceGuidanceCoachFreeze": "PASS — true/false Coach prepareForStart→commitStart freeze and persisted reload; manual path unchanged." if regression_status == "PASS" else "PENDING",
            "directDeriveBaselineValidity": "PASS — OFF→same-ID invalid baseline import→ON; direct derive is first, invalid BASELINE row is excluded before core, stale ID/authority cleared." if regression_status == "PASS" else "PENDING",
        },
        "v3AcceptanceStatus": acceptance_status,
        "v3AcceptanceFixtureCount": 102,
        "currentCandidateVerification": {
            "masterRegression": status,
            "v3Acceptance": acceptance_status,
            "releaseIntegrity": "PASS — deterministic generator/test verifies exact artifact hashes and both normalized manifest self-hashes." if regression_status == "PASS" else "PENDING",
            "realBrowser": "PASS — author-run Chromium DOM interactions on localhost with a disposable profile; independent QA and WebView/Android/iOS NOT_VERIFIED.",
            "zipExtraction": "PASS — source ZIP member bytes match the project tree." if zip_status == "PASS" else "PENDING — final ZIP member-by-member comparison remains.",
        },
    })
    decomp["newModules"] = sorted(set(decomp.get("newModules", []) + ["src/infrastructure/storage/coach_state_migration_v3.js"]))
    decomp["implementationChanges"] = [
        "Coach defaults ON; only explicit user preference persists as an override; unmarked legacy false is treated as default ON.",
        "Global fail-closed Coach gate across application, adapter and lifecycle APIs; OFF session completion uses immutable start-time snapshot passively.",
        "Canonical History edit/delete/clear invalidation and stale pending/baseline pointer exclusion.",
            "Confirmed UX: Plan exercise selector/count and up/down arrows share one continuous outer surface; arrows identify exercise and direction and disable at list boundaries; reordering changes composition only, not target/longGoal. Exclusions retain the existing userRestrictions contract.",
        "Confirmed UX: clearer progress copy with independent period filters, persistent sound setting, voice Пауза through the existing pause/session contract, and one-OK result routing back to Workout.",
        "Workout primary action uses distinct ready/live/pressed depth states with smooth normal-motion transition and reduced-motion support; scoring, session contracts and Coach core behavior are unchanged.",
        "Profile trainingExperience remains unchanged and disabled pending an approved enum; existing Matrix/config alone may gate coachEligibility, with no generic workload effect.",
        "Recoverable V2.8 migration with exact backup/checksum/read-back/receipt/rollback; unsupported schema leaves legacy key intact and identifies the field blocker.",
        "Adaptive Coach V3 normative gaps: future-dated evidence, explanation-variable provenance, bodyweight diagnostic scope, release identity and frozen semantic snapshots.",
        "Deterministic SHA-256 release process with service-worker cache identity and per-artifact regression assertions.",
        "Plan paceGuidance is frozen as combined-mode session runtime metadata from CoachInput.config, without changing CoachCore adaptation or WorkoutSpec schema.",
        "Public derive/start revalidate canonical baseline records; invalid same-ID BASELINE History is excluded before CoachCore and stale authority/ID are cleared.",
    ]
    existing_gaps = [item for item in decomp.get("remainingKnownGaps", []) if not item.startswith("No real Chromium/WebView") and not item.startswith("No ZIP package/extracted candidate") and not item.startswith("The final source ZIP remains PENDING")]
    zip_gap = [] if zip_status == "PASS" else [
        "The final source ZIP remains PENDING until --zip-status PASS is generated after the member-by-member comparison.",
    ]
    decomp["remainingKnownGaps"] = list(dict.fromkeys(existing_gaps + [
        "V2.8 migration is intentionally limited to the one evidenced boolean field calibrationRequested; any other legacy key is a specific non-destructive blocker until its schema is substantiated.",
        "Independent QA and Android/iOS/WebView validation remain outstanding; the author-run Chromium suite covers only the confirmed UX scope.",
    ] + zip_gap))
    decomp["manifestHash"] = normalized_manifest_hash(decomp)
    write_json(decomp_path, decomp)

    # Read-back checks ensure the generated files express the same exact candidate.
    generated_release = json.loads(release_path.read_text(encoding="utf-8"))
    generated_decomp = json.loads(decomp_path.read_text(encoding="utf-8"))
    if generated_release["manifestHash"] != normalized_manifest_hash(generated_release):
        raise SystemExit("release manifest self-hash read-back mismatch")
    if generated_decomp["manifestHash"] != normalized_manifest_hash(generated_decomp):
        raise SystemExit("decomposition manifest self-hash read-back mismatch")
    if generated_decomp["releaseManifestHash"] != sha_file("release-manifest.json"):
        raise SystemExit("decomposition release-manifest hash read-back mismatch")
    if normalized_source_map() != source_map:
        raise SystemExit("normalized runtime source changed during release generation")
    print(json.dumps({
        "releaseCandidateId": generated_release["releaseCandidateId"],
        "integrityVersion": INTEGRITY_VERSION,
        "releaseSourceHash": source_hash,
        "releaseBuildHash": build_hash,
        "artifactSetHash": artifact_set_hash,
        "artifactCount": len(artifact_hashes),
        "masterRegressionStatus": generated_release["masterRegressionStatus"],
        "releaseManifestHash": sha_file("release-manifest.json"),
        "decompositionManifestHash": sha_file("decomposition-manifest.json"),
    }, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--regression-status", choices=["PENDING", "PASS"], default="PENDING")
    parser.add_argument("--zip-status", choices=["PENDING", "PASS"], default="PENDING")
    args = parser.parse_args()
    generate(args.regression_status, args.zip_status)
