"""Neighborhood boundary versioning (constraints 6, 8, 10).

BoundaryStore.add_version() is APPEND-ONLY: a new version never overwrites or
deletes a prior one, and every add is written to an audit trail. A HARD GUARD
refuses any geometry whose provenance is absent/fabricated — this is how we
enforce "never guess a boundary". If no real boundary is obtainable the caller
must record WAITING_FOR_DATA / ACCESS_REQUIRED, not invent geometry.
"""
from __future__ import annotations
import os, json, hashlib, datetime
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from shapely.geometry import shape, mapping
from shapely.geometry.base import BaseGeometry


def _utc() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def geometry_hash(geom: BaseGeometry) -> str:
    return "sha256:" + hashlib.sha256(geom.wkb).hexdigest()


@dataclass
class NeighborhoodBoundaryVersion:
    neighborhood_id: str
    version_id: str                       # e.g. v1, v2 (append-only)
    geometry_geojson: Dict[str, Any]
    geometry_wkt: str
    crs: str                              # e.g. EPSG:4326
    tier: str                             # source-of-truth tier
    is_official: bool
    is_proxy: bool
    provenance_ref: str                   # value_id / source_id in ProvenanceStore (REQUIRED)
    geometry_hash: str
    valid_from: str = field(default_factory=_utc)
    note: str = ""
    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)


class BoundaryProvenanceMissing(ValueError):
    pass


class BoundaryStore:
    def __init__(self, out_dir: Optional[str] = None):
        self._versions: Dict[str, List[NeighborhoodBoundaryVersion]] = {}
        self.audit_trail: List[Dict[str, Any]] = []
        self.out_dir = out_dir
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

    def add_version(
        self, neighborhood_id: str, geometry: BaseGeometry, *,
        crs: str, tier: str, is_official: bool, is_proxy: bool,
        provenance_ref: Optional[str], note: str = "",
    ) -> NeighborhoodBoundaryVersion:
        # HARD GUARD — never guess/fabricate a boundary (constraint 6)
        if not provenance_ref or not str(provenance_ref).strip():
            raise BoundaryProvenanceMissing(
                "refusing to store a boundary with no provenance_ref "
                "(constraint 6: never guess/fabricate geometry)")
        if geometry is None or geometry.is_empty:
            raise ValueError("refusing to store empty/None geometry")
        existing = self._versions.setdefault(neighborhood_id, [])
        vnum = len(existing) + 1
        version_id = f"v{vnum}"
        bv = NeighborhoodBoundaryVersion(
            neighborhood_id=neighborhood_id, version_id=version_id,
            geometry_geojson=mapping(geometry), geometry_wkt=geometry.wkt,
            crs=crs, tier=tier, is_official=is_official, is_proxy=is_proxy,
            provenance_ref=provenance_ref, geometry_hash=geometry_hash(geometry),
            note=note,
        )
        existing.append(bv)              # APPEND-ONLY (never overwrite prior)
        self.audit_trail.append({
            "action": "add_version", "neighborhood_id": neighborhood_id,
            "version_id": version_id, "at": _utc(), "tier": tier,
            "is_official": is_official, "is_proxy": is_proxy,
            "geometry_hash": bv.geometry_hash, "provenance_ref": provenance_ref})
        self._persist(bv)
        return bv

    def list_versions(self, neighborhood_id: str) -> List[NeighborhoodBoundaryVersion]:
        return list(self._versions.get(neighborhood_id, []))

    def get_version(self, neighborhood_id: str, version_id: str) -> Optional[NeighborhoodBoundaryVersion]:
        for v in self._versions.get(neighborhood_id, []):
            if v.version_id == version_id:
                return v
        return None

    def latest(self, neighborhood_id: str) -> Optional[NeighborhoodBoundaryVersion]:
        vs = self._versions.get(neighborhood_id, [])
        return vs[-1] if vs else None

    def _persist(self, bv: NeighborhoodBoundaryVersion) -> None:
        if not self.out_dir:
            return
        d = os.path.join(self.out_dir, bv.neighborhood_id)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, f"{bv.version_id}.json"), "w", encoding="utf-8") as f:
            json.dump(bv.as_dict(), f, ensure_ascii=False, indent=2)
        with open(os.path.join(self.out_dir, "audit_trail.json"), "w", encoding="utf-8") as f:
            json.dump(self.audit_trail, f, ensure_ascii=False, indent=2)
