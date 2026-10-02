# ADR-004: Metadata-first COG and spatial-index pipeline

## Status

Accepted

## Context

The application needs repeatable, low-latency satellite imagery for several UI and analysis modules. STAC metadata must remain independent from raster processing, and intelligent models must not consume unvalidated data. The current backend is a single Express/TypeScript service and development machines may differ in native GIS tooling.

## Decision

Use a file-backed, asynchronous processing job contract in the Express backend and a small Python/Rasterio worker for raster operations:

- STAC metadata is the immutable source reference (`metadata_id`).
- Jobs have explicit `queued → downloading → processing → ready|failed` states and persist to `server/data/satellite-pipeline.json`.
- The worker reads only the requested AOI, aligns bands to a common grid, applies Sentinel-2 SCL masking, writes tiled Deflate Cloud Optimized GeoTIFFs with overviews, and emits checksums/provenance.
- Deterministic indices are produced before any future ML stage: NDVI, NDWI, MNDWI, NDBI, NDMI, NBR, and Sentinel-1 VV/VH/ratio.
- Artifact bounding boxes are indexed in SQLite R*Tree (`server/data/satellite-spatial.sqlite`); a JSON sidecar keeps the API usable on older Node runtimes.

## Rationale

1. Rasterio/GDAL provide the mature GeoTIFF/COG and reprojection implementation without pulling heavy native code into the Node dependency graph.
2. AOI windows and overviews control memory, network transfer, and tile latency.
3. A persisted job/provenance contract allows retries, auditing, and later replacement of the worker with a queue service.
4. R*Tree bounding-box queries are sufficient for the first spatial catalog; PostGIS can replace it when concurrent multi-user scale requires it.

## Trade-offs

- Python is an additional runtime and must be installed in deployments.
- CDSE `s3://eodata` assets may require credentials; public HTTPS Earth Search assets work without secrets.
- SQLite is local to one backend instance; it is not a distributed catalog.

## Revisit triggers

- More than one worker process or multiple API replicas.
- Need for polygon intersection, temporal cubes, or >10 million artifacts.
- Requirement for GPU inference after deterministic data validation.
