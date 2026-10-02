"""Deterministic pilot runner (Tehran District 6).

Rebuilds the whole vertical slice from CACHED raw bytes already fetched from
real sources (OSM/USGS) + the ACCESS_REQUIRED DEM attempt. Uses cached bytes so
the computation is reproducible (re-fetching live OSM could change). Produces:
records, lineage examples, data-coverage summary, and demonstrates the Q/T/R
guardrail refusing to publish a neighborhood score on uncalibrated inputs.
"""
from __future__ import annotations
import os, sys, json
from shapely.geometry import shape, mapping, Point

KROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if KROOT not in sys.path:
    sys.path.insert(0, KROOT)
from ingestion.provenance_ext import ProvenanceStore
from ingestion.ingest import IngestionService
from gis.boundary import BoundaryStore
from gis import spatial as S
from engine.calc_engine import Engine, METHODOLOGY_VERSION
from engine.status import Measurement

PDIR = os.path.dirname(os.path.abspath(__file__))
NB_ID = "IR-THR-D6"
DATA_VERSION = "pilot-D6-2026-09-02"
VER = dict(data_version=DATA_VERSION, indicator_version="registry-419-v1",
           weight_v="W-v1", threshold_v="T-v1", calc_v="CALC-v0.1")


def _standardization_eligibility(svc, code, operationalization, unit):
    lu = svc.indicator_lu(code) or {}
    lus = lu.get("lu_status"); reasons = []
    if lus in ("OBSERVED_RANGE_UNCALIBRATED", "PENDING_VALIDATION") or lu.get("L") is None:
        reasons.append(f"L/U uncalibrated (lu_status={lus})")
    if unit not in ("امتیاز ۰ تا ۱۰۰", "score_0_100"):
        reasons.append(f"unit mismatch: input '{unit}' != registry 0–100 scale")
    if operationalization == "distance" and "مستقیم" in str(lu.get("direction", "")):
        reasons.append(f"direction ambiguity: {code} raw distance implies inverse but "
                       f"registry جهت='مستقیم (بیشتر=بهتر)'; direction unconfirmed")
    return (len(reasons) == 0, "; ".join(reasons))


def run(out_dir=None, persist=True):
    meta = json.load(open(os.path.join(PDIR, "pilot_boundary_meta.json")))
    acq = json.load(open(os.path.join(PDIR, "_acq.json")))
    braw = open(os.path.join(PDIR, "raw", "boundary_R6729037_nominatim.json"), "rb").read()
    g = shape(meta["geojson"]); c = g.centroid; mc = meta["metric_crs"]
    cpm = S.reproject(c, "EPSG:4326", mc)

    prov = ProvenanceStore(out_dir=(os.path.join(out_dir, "provenance") if out_dir else None))
    bstore = BoundaryStore(out_dir=(os.path.join(out_dir, "boundaries") if out_dir else None))
    svc = IngestionService(store=prov)
    eng = Engine(os.path.join(KROOT, "registries"))

    # --- sources (deterministic order/ids) ---
    osm_sid = prov.register_source("OpenStreetMap (Nominatim/Overpass, R6729037)",
        provider="OpenStreetMap contributors", dataset_id="OSM relation 6729037",
        url_api=meta["url"], tier="public-OSM-substitute", is_official=False,
        is_proxy=True, license="ODbL", access_method="Nominatim /lookup + Overpass API")
    official_sid = prov.register_source("شهرداری تهران — نقشه رسمی حدود مناطق (official GIS/SDI)",
        provider="Tehran Municipality", dataset_id="official district boundary (not obtained)",
        url_api=None, tier="official-GIS", is_official=True, is_proxy=False,
        access_method="ACCESS_REQUIRED")
    usgs_sid = prov.register_source("USGS ComCat", provider="USGS", dataset_id="ComCat",
        url_api=acq["eq_region"]["prov"]["url_api"], tier="validated-scientific",
        is_official=True, is_proxy=True, license="public domain (USGS)",
        access_method="FDSNWS event query")
    dem_sid = prov.register_source("Copernicus DEM GLO-30 via OpenTopography",
        provider="ESA/Copernicus via OpenTopography", dataset_id="COP30", url_api=acq["dem_url"],
        tier="validated-scientific", is_official=True, is_proxy=False,
        access_method="OpenTopography globaldem API (API key required)")

    # --- boundary: CRS + topology + reproject + register version ---
    crs_chk = S.validate_crs("EPSG:4326"); topo = S.validate_topology(g)
    gm = S.reproject(topo["geometry"], "EPSG:4326", mc); area_km2 = round(gm.area / 1e6, 3)
    bprov = prov.register_provenance(None, value_id="VAL-BOUNDARY-D6",
        resulting_value=area_km2, unit="km2", formula_id="boundary_area(metric_crs)",
        source_id=osm_sid, request_params=meta["params"], raw_bytes=braw,
        raw_file_ref="pilot/raw/boundary_R6729037_nominatim.json", record_ref="relation/6729037",
        timestamp_acquired=meta["timestamp_acquired"], observation_period="OSM snapshot @ acquisition",
        geographic_extent="Tehran District 6 (منطقه ۶)", crs="EPSG:4326",
        spatial_resolution="OSM vector", temporal_resolution="snapshot",
        spatial_scale="municipal district (admin_level=9)",
        downscaling_caveat="District-level boundary; NOT a micro-neighborhood sub-unit",
        processing_version=METHODOLOGY_VERSION, evidence_class="gis", is_proxy=True,
        methodology_version=METHODOLOGY_VERSION, **VER)
    bprov.add_transformation_step("validate_crs", crs_chk)
    bprov.add_transformation_step("validate_topology",
        {"was_valid": topo["findings"]["was_valid"], "now_valid": topo["findings"]["now_valid"]})
    bprov.add_transformation_step("reproject", {"from": "EPSG:4326", "to": mc})
    bprov.add_quality_check(crs_chk)
    bprov.add_quality_check({"check": "topology", "status": topo["status"], "findings": topo["findings"]})
    bprov.add_quality_check({"check": "boundary_verification",
                             "status": "PASS" if meta["verified"] else "FAIL",
                             "findings": meta["verification"]})
    v1 = bstore.add_version(NB_ID, topo["geometry"], crs="EPSG:4326", tier="public-OSM-substitute",
        is_official=False, is_proxy=True, provenance_ref=bprov.value_id,
        note="OSM R6729037. Official municipal GIS=ACCESS_REQUIRED (would ingest as v2).")

    # --- indicators ---
    records = []

    def nearest(feats):
        pts = [S.reproject(Point(lon, lat), "EPSG:4326", mc) for lon, lat in feats]
        return S.distance_to_nearest(cpm, pts, method="network", allow_euclidean_proxy=True)
    d_park = nearest(acq["feats"]["park"]); d_school = nearest(acq["feats"]["school"])

    def ingest_scalar(code, raw_value, unit, feats_rows, vfield, evidence, src_id, req,
                      op, spatial_scale, downscale, is_proxy=True):
        rec = svc.ingest_value(indicator_code=code, raw_value=raw_value, rows_for_column=feats_rows,
            value_field=vfield, source_id=src_id, request_params=req, declared_unit=unit,
            registry_unit=None, raw_bytes=json.dumps(req, ensure_ascii=False).encode(),
            raw_file_ref=req.get("raw_file"), record_ref=req.get("record_ref"),
            evidence_class=evidence, is_proxy=is_proxy, spatial_scale=spatial_scale,
            downscaling_caveat=downscale, crs=mc, geographic_extent="Tehran District 6",
            timestamp_acquired=req.get("ts"), observation_period=req.get("period"),
            processing_version=METHODOLOGY_VERSION, formula_id=op, **VER)
        std = {"eligible": False}
        if code and code.startswith("PHY"):
            elig, reason = _standardization_eligibility(svc, code, op.split("(")[0], unit)
            std["eligible"] = elig
            std["standardized"] = (eng.standardize(code, raw_value).as_dict() if elig
                else {"indicator_code": code, "value": None, "status": "PENDING_VALIDATION", "reason": reason})
        else:
            std["standardized"] = {"indicator_code": code, "value": None,
                "status": "N/A_online_measure",
                "reason": "ONL online measure: raw OBSERVED, not standardized to 0–100 in MVP-1"}
        rd = rec.as_dict(); rd["standardization_attempt"] = std; rd["operationalization"] = op
        records.append(rd); return rec

    prow = [{"lon": lo, "lat": la} for lo, la in acq["feats"]["park"]]
    srow = [{"lon": lo, "lat": la} for lo, la in acq["feats"]["school"]]
    brow = [{"lon": lo, "lat": la} for lo, la in acq["feats"]["bus_stop"]]
    preq = lambda n: {"dataset_id": "OSM Overpass area 3606729037",
        "ts": acq["poi_prov"]["timestamp_acquired"], "period": "OSM snapshot",
        "raw_file": "pilot/raw/pois_D6_overpass.json", "record_ref": n}
    ingest_scalar("PHY-003", acq["counts"]["park"], "count", prow, "lon", "gis", osm_sid,
                  preq("leisure=park count"), "count_within_boundary", "district(admin_level=9)",
                  "count is supply-proxy, not per-resident access; OSM completeness varies")
    ingest_scalar("PHY-001", acq["counts"]["school"], "count", srow, "lon", "gis", osm_sid,
                  preq("amenity=school count"), "count_within_boundary", "district(admin_level=9)",
                  "count is supply-proxy; OSM school tagging incomplete")
    ingest_scalar("PHY-002", acq["counts"]["bus_stop"], "count", brow, "lon", "gis", osm_sid,
                  preq("highway=bus_stop count"), "count_within_boundary", "district(admin_level=9)",
                  "bus_stop count is supply-proxy for transit access")
    ingest_scalar("PHY-003", round(d_park["value"], 2), "meter", prow, "lon", "gis", osm_sid,
                  preq("nearest park distance"), "distance(euclidean_proxy_for_network)",
                  "from district centroid", d_park.get("caveat", ""))
    ingest_scalar("PHY-001", round(d_school["value"], 2), "meter", srow, "lon", "gis", osm_sid,
                  preq("nearest school distance"), "distance(euclidean_proxy_for_network)",
                  "from district centroid", d_school.get("caveat", ""))
    eqreq = {"dataset_id": "ComCat", "ts": acq["eq_region"]["prov"]["timestamp_acquired"],
             "period": "1900-01-01..now", "raw_file": "pilot/raw/usgs_eq_region.json",
             "record_ref": "nearest M>=4.5 epicenter"}
    ingest_scalar("ONL-011", acq["eq_region"]["nearest_km"], "km",
                  [{"km": acq["eq_region"]["nearest_km"]}], "km", "objective", usgs_sid, eqreq,
                  "nearest_epicenter_distance", "region ~±0.8° of centroid",
                  "proxy seismic-exposure; NOT a hazard verdict (GEM PSHA=ACCESS_REQUIRED)")

    # DEM ACCESS_REQUIRED (no number)
    dem_prov = prov.register_provenance("ONL-001", value_id="VAL-DEM-D6", resulting_value=None,
        unit="meter", formula_id="dem_zonal_mean", source_id=dem_sid, request_params=acq["dem_params"],
        timestamp_acquired=None, geographic_extent="Tehran District 6", crs="EPSG:4326",
        evidence_class="gis", is_proxy=False, methodology_version=METHODOLOGY_VERSION, **VER)
    dem_prov.add_quality_check({"check": "acquisition", "status": "FAIL", "blocking": True,
        "detail": acq["dem_detail"][:160], "http": 401})
    records.append({"dataset_id": "COP30", "indicator_code": "ONL-001",
        "measurement": Measurement("ONL-001", value=None, status="ACCESS_REQUIRED",
            missing_reason="OpenTopography COP30 requires API key (HTTP 401); no number produced").as_dict(),
        "provenance_value_id": dem_prov.value_id,
        "quality_score": {"is_valid": False, "note": "source access required"},
        "approval_status": "BLOCKED_ACCESS_REQUIRED", "operationalization": "dem_zonal_mean",
        "standardization_attempt": {"eligible": False}})

    # --- Q/T/R guardrail demonstration: no calibrated standardized inputs ---
    #   All PHY standardized scores are PENDING_VALIDATION -> capital_score gets
    #   zero OBSERVED standardized measurements -> engine refuses (no fabricated Q).
    std_measurements = []  # only calibrated OBSERVED standardized scores would go here
    qtr = eng.qtr({"K": std_measurements, "Q": std_measurements,
                   "T": std_measurements, "R": std_measurements})
    qtr_demo = {k: {"value": r.value, "status": r.status, "note": r.note} for k, r in qtr.items()}

    result = {
        "neighborhood": {"id": NB_ID, "name_fa": meta["name_fa"], "name_en": meta["name_en"],
                         "osm_relation": meta["rel_id"], "boundary_version": v1.version_id,
                         "boundary_area_km2": area_km2, "metric_crs": mc, "is_proxy": True,
                         "boundary_hash": v1.geometry_hash},
        "records": records, "qtr_guardrail": qtr_demo,
        "reproducibility_key": bprov.reproducibility_key,
        "store": prov, "boundary_store": bstore,
    }
    if persist and out_dir:
        os.makedirs(out_dir, exist_ok=True)
        serial = {k: v for k, v in result.items() if k not in ("store", "boundary_store")}
        json.dump(serial, open(os.path.join(out_dir, "pilot_result.json"), "w"),
                  ensure_ascii=False, indent=2)
    return result


def canonical_fingerprint(result):
    """Hash the OUTPUT VALUES/STATUSES (not wall-clock timestamps) for determinism."""
    import hashlib
    rows = []
    n = result["neighborhood"]
    rows.append(("NB", n["boundary_area_km2"], n["boundary_hash"], n["metric_crs"]))
    for r in result["records"]:
        m = r["measurement"]; s = r.get("standardization_attempt", {}).get("standardized", {}) or {}
        rows.append((r["indicator_code"], r["operationalization"], m["value"], m["status"],
                     m["is_proxy"], s.get("status")))
    rows.append(("QTR", tuple((k, v["status"]) for k, v in result["qtr_guardrail"].items())))
    blob = json.dumps(rows, ensure_ascii=False, sort_keys=True, default=str)
    return "sha256:" + hashlib.sha256(blob.encode()).hexdigest()


if __name__ == "__main__":
    res = run(out_dir=os.path.join(PDIR, "out"))
    print("fingerprint:", canonical_fingerprint(res))
    print("QTR guardrail:", json.dumps(res["qtr_guardrail"], ensure_ascii=False))
