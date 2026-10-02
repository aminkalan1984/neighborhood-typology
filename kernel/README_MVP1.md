# Neighborhood Intelligence Platform — kernel v1 (MVP-1 + GIS start)

Extends kernel v0 (methodology kernel + calculation engine). ADDS:
- `ingestion/` — Real Data Ingestion Service: loaders (CSV/JSON/GeoJSON), structured
  validators (schema/type/null-missing/duplicate/unit/date/range/outlier + quality score),
  full provenance/lineage (`provenance_ext.py`), orchestrator + manual-approval workflow +
  calculation GATE (`ingest.py`). Contract tests: 27/27.
- `gis/` — GIS Service: append-only boundary versioning + never-guess guard (`boundary.py`),
  CRS/topology validation + Iran metric-CRS selection + no-silent-Euclidean distance (`spatial.py`),
  real-data connectors Nominatim/Overpass/USGS/OpenTopography (`acquire.py`). Contract tests: 18/18.
- `pilot/` — real vertical slice on Tehran District 6 (OSM relation R6729037): verified boundary,
  6 real indicator inputs, DEM ACCESS_REQUIRED, lineage, coverage summary, reproducibility, gate report.

## Integrity rules enforced
No mock/fake data; missing != 0 (status.py guard); INVALID blocks calc; complete provenance + 10-level
drill-down; boundaries versioned + never guessed; CRS+topology validated; no silent Euclidean-for-network;
proxies labeled (OSM/USGS is_proxy=true); formulas/weights/thresholds from versioned registries only.

## Reproducibility key
Data Version + Methodology Version (algo.txt-2026) + Indicator Version (registry-419-v1) +
Weight Set (W-v1) + Threshold Set (T-v1) + Calculation Version (CALC-v0.1).

## Gates (this run)
MVP-1 gate = CONDITIONAL PASS ; GIS gate = CONDITIONAL PASS. Conditions: boundary is OSM proxy
(official GIS = ACCESS_REQUIRED); PHY standardized scores = PENDING_VALIDATION (FLAG-2); DEM = ACCESS_REQUIRED.
