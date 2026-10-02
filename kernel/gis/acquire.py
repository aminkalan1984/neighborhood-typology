"""Real-data acquisition connectors (constraints 1, 3, 8).

Each connector:
  * has a health_check(),
  * makes an anonymous/secure request,
  * on failure returns a STATUS (SOURCE_UNAVAILABLE / ACCESS_REQUIRED) with NO
    data — never fabricates, never returns cached data as if fresh,
  * captures full provenance (url, params, timestamp, dataset id, raw hash).

Only free, no-login public sources are used here:
  * Nominatim / Overpass (OpenStreetMap, ODbL) — labeled PROXY per FLAG 1.
  * USGS ComCat earthquakes (public REST GeoJSON) — atlas flags is_proxy.
"""
from __future__ import annotations
import json, hashlib, datetime
from typing import Any, Dict, List, Optional

import requests

UA = "NeighborhoodIntelligencePlatform-MVP1/0.1 (research; contact: platform-admin)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
USGS_COMCAT = "https://earthquake.usgs.gov/fdsnws/event/1/query"


def _utc() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _hash(b: bytes) -> str:
    return "sha256:" + hashlib.sha256(b).hexdigest()


def _fail(source: str, url: str, params: Dict[str, Any], exc: Exception,
          status: str = "SOURCE_UNAVAILABLE") -> Dict[str, Any]:
    return {"status": status, "data": None, "source": source,
            "provenance": {"url_api": url, "request_params": params,
                           "timestamp_attempted": _utc(), "error": str(exc)},
            "detail": f"{source} unreachable: {exc}. No data produced (no fabrication)."}


def health_check(url: str, timeout: int = 15) -> Dict[str, Any]:
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout)
        return {"ok": r.status_code < 500, "status_code": r.status_code, "url": url}
    except Exception as e:
        return {"ok": False, "status_code": None, "url": url, "error": str(e)}


def nominatim_lookup(query: str, *, country: str = "Iran", limit: int = 5,
                     timeout: int = 30) -> Dict[str, Any]:
    params = {"q": f"{query}, {country}", "format": "jsonv2", "polygon_geojson": 1,
              "limit": limit, "addressdetails": 1}
    try:
        r = requests.get(NOMINATIM, params=params, headers={"User-Agent": UA}, timeout=timeout)
        r.raise_for_status()
        raw = r.content
        data = r.json()
        return {"status": "OBSERVED", "data": data, "source": "OpenStreetMap/Nominatim",
                "provenance": {"url_api": NOMINATIM, "request_params": params,
                               "timestamp_acquired": _utc(), "raw_file_hash": _hash(raw),
                               "license": "ODbL", "provider": "OpenStreetMap contributors",
                               "is_proxy": True}}
    except Exception as e:
        return _fail("OpenStreetMap/Nominatim", NOMINATIM, params, e)


def overpass_fetch(ql: str, *, timeout: int = 90) -> Dict[str, Any]:
    params = {"data": ql}
    last_exc: Optional[Exception] = None
    for ep in OVERPASS_ENDPOINTS:
        try:
            r = requests.post(ep, data=params, headers={"User-Agent": UA}, timeout=timeout)
            r.raise_for_status()
            raw = r.content
            data = r.json()
            return {"status": "OBSERVED", "data": data, "source": "OpenStreetMap/Overpass",
                    "provenance": {"url_api": ep, "request_params": {"ql": ql},
                                   "timestamp_acquired": _utc(), "raw_file_hash": _hash(raw),
                                   "license": "ODbL", "provider": "OpenStreetMap contributors",
                                   "is_proxy": True}}
        except Exception as e:
            last_exc = e
            continue
    return _fail("OpenStreetMap/Overpass", OVERPASS_ENDPOINTS[0], {"ql": ql}, last_exc)


def usgs_comcat_fetch(min_lat: float, max_lat: float, min_lon: float, max_lon: float,
                      *, starttime: str = "1970-01-01", minmagnitude: float = 4.0,
                      timeout: int = 60) -> Dict[str, Any]:
    params = {"format": "geojson", "minlatitude": min_lat, "maxlatitude": max_lat,
              "minlongitude": min_lon, "maxlongitude": max_lon,
              "starttime": starttime, "minmagnitude": minmagnitude}
    try:
        r = requests.get(USGS_COMCAT, params=params, headers={"User-Agent": UA}, timeout=timeout)
        r.raise_for_status()
        raw = r.content
        data = r.json()
        return {"status": "OBSERVED", "data": data, "source": "USGS ComCat",
                "provenance": {"url_api": USGS_COMCAT, "request_params": params,
                               "timestamp_acquired": _utc(), "raw_file_hash": _hash(raw),
                               "license": "public domain (USGS)", "provider": "USGS",
                               "dataset_id": "ComCat", "is_proxy": True}}
    except Exception as e:
        return _fail("USGS ComCat", USGS_COMCAT, params, e)
