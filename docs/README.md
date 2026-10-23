# PicWiz documentation

[English README](../README.md) · [中文 README](../README.zh-CN.md) · [Contributing](../CONTRIBUTING.md)

The running application is **V2**. V3 documents describe the approved next-stage scope; they do not mean those features, services or tests exist yet. Product research and most specifications are in Chinese. User and contributor guides are in English.

## Use and run PicWiz

| You want to… | Start here |
| --- | --- |
| Create a social image, reuse a look or export a batch | [Usage guide](guides/usage.md) |
| Install, navigate the code or run tests | [Development guide](guides/development.md) |
| Understand local ownership, backup, migration or restore | [Local data and recovery](guides/local-data.md) |
| Deploy, inspect headers or diagnose a failure | [Deployment guide](guides/deployment.md) |
| Use reproducible demo inputs | [Fictional fixtures](../public/fixtures/README.md) |
| Update the actual interface screenshots | [Screenshot guide](guides/screenshots.md) |
| Report a vulnerability or ask for help | [Security](../SECURITY.md) · [Support](../SUPPORT.md) |

## Understand the current architecture

- [Architecture](architecture.md): routes, browser adapters, runtime and privacy boundaries.
- [Data model](data-model.md): Composition, StylePreset, ExportJob, lifecycle and local persistence constraints.
- [V2 core contract](v2/core-contract.md): current domain, rendering and repository interfaces.
- [V2 validation](v2/validation.md): actual commands, results, reviewed fixes and evidence limits.

## V2: implemented product

Read the product rationale before the detailed implementation contract. In a conflict, the V2 specification's **R1–R5 amendments are authoritative**. Review verdicts describe the reviewed scope; validation records distinguish requirements from tests actually run.

| Document | Purpose |
| --- | --- |
| [Market research](v2/market-research.md) | Competitor evidence and cited platform constraints. |
| [PRD](v2/prd.md) | Audience, outcomes, scope and acceptance. |
| [Product design](v2/product-design.md) | Journeys, interaction and recovery design. |
| [Implementation spec](v2/spec.md) | Detailed behavior, boundaries and authoritative amendments. |
| [Review record](v2/review.md) | Independent findings, changes and remaining risks. |
| [Validation record](v2/validation.md) | Completed implementation checks. |

Implementation handoffs remain available for context: [data/rendering](v2/data-contract-notes.md), [batch/ZIP](v2/batch-contract-notes.md), [browser tests](v2/browser-test-notes.md). They do not override the final specification or current code.

## V3: next-stage implementation specifications

The selected directions are **D1B — Headless CMS**, **D2A — procedural Three.js models**, **D3A — browser video POC with device probes**, and **D4C — Clerk hosted SDK with explicit appearance-only sync**. These specifications have been reviewed **READY WITH RISKS**. No V3 integration, migration, dependency or provider resource is implemented by these documents.

Read the [root specification](v3/spec.md) first: its shared Scene, migration, ownership, security and sequencing contracts govern the three detail documents.

| Document | Scope |
| --- | --- |
| [Root specification](v3/spec.md) | Shared technical plan, routes, data, boundaries, migration and delivery gates. |
| [Gallery specification](v3/gallery-spec.md) | Sanity CMS, immutable template revisions, publication, retention and rollback. |
| [Account specification](v3/accounts-spec.md) | Clerk, strict cloud DTOs, authorization, sync conflicts, export and deletion. |
| [3D and video POC specification](v3/render-poc-spec.md) | Independent local experiments, resource ownership, actual capability probes and stop criteria. |
| [Specification review](v3/review.md) | Findings and responses; explicitly not implementation evidence. |

GPU/codec/device proofs, CMS permissions, provider configuration, licensing, operating budgets and restore drills remain future delivery gates. V2's passing tests do not prove V3 capability.

## Research and historical material

The [future product design](future/product-design.md), [decision options](future/decisions.md), [Gallery/3D comparison](future/gallery-and-3d.md), [video analysis](future/video.md), [account analysis](future/accounts.md) and [research reviews](future/review.md) explain the choices. Alternatives and recommendations there are historical; the chosen V3 specification takes precedence.

[V1 core contract](core-contract.md) is retained for migration history. It is not the current API contract. Historical names and `shinyshot:store` references remain where required for compatibility and provenance.

HTML design briefs are presentation artifacts, not running product pages: [V2 design](v2/design-preview.html), [archived decision brief](future/decision-brief.html), [V3 scope brief](v3/spec-brief.html). Download/open them locally to view their rendered layout; GitHub's file view shows source.
