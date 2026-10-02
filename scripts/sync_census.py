# -*- coding: utf-8 -*-
"""Sync the heavy census microdata (Portals/0/census/raw-data/cn_z) into a
compact, defensible aggregate for the backend API.

The source is a weighted SAMPLE of a national census (fardXX = persons,
khXX = households, one zip per province bucket). Column names are anonymous
(Col01..col6x), so demographics are reverse-engineered by value distribution
and flagged `verifiedByCodebook: false`:

  col07  -> sex        (values 1=male / 2=female, perfectly balanced)
  col10  -> age in years (0..99)
  col40  -> urban/rural (1=urban / 2=rural), present on household records
  w1     -> expansion weight (w == 1.0 raw)
  FormNo -> household id (to derive household size from person records)

Province = file index (00..29). The national weighted total is used to date
the census (1385 ~70.5M; 1375 ~60M) — printed and stored in the output.

Output: server/data/census-<year>.json
"""
import collections, io, json, pathlib, struct, sys, zipfile

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parent.parent
ZIP_DIR = ROOT / "Portals" / "0" / "census" / "raw-data" / "cn_z"
OUT_DIR = ROOT / "server" / "data"

AGE_BANDS = ["0-4", "5-9", "10-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65+"]

def age_band(a):
    if a < 0 or a > 120:
        return None
    if a < 5: return "0-4"
    if a < 10: return "5-9"
    if a < 15: return "10-14"
    if a < 25: return "15-24"
    if a < 35: return "25-34"
    if a < 45: return "35-44"
    if a < 55: return "45-54"
    if a < 65: return "55-64"
    return "65+"

def read_dbf(path):
    """Yield parsed records as dicts from a dbf (pure struct)."""
    with open(path, "rb") as f:
        h = f.read(32)
        nrec = struct.unpack("<I", h[4:8])[0]
        hlen = struct.unpack("<H", h[8:10])[0]
        rlen = struct.unpack("<H", h[10:12])[0]
        fields = []
        while True:
            d = f.read(32)
            if d[0] == 0x0D:
                break
            name = d[:11].split(b"\x00")[0].decode("ascii", "replace")
            fields.append((name, chr(d[11]), d[16], d[17]))
        f.seek(hlen)
        for _ in range(nrec):
            rec = f.read(rlen)
            if len(rec) < rlen:
                break
            if rec[0] == 0x2A:  # deleted record
                continue
            body = rec[1:]
            off = 0
            out = {}
            for (name, ftype, flen, fdec) in fields:
                raw = body[off:off + flen]
                off += flen
                if ftype in "NnFf":
                    s = raw.decode("ascii", "replace").strip()
                    try:
                        out[name] = float(s)
                    except ValueError:
                        out[name] = None
                else:
                    out[name] = raw.decode("cp1256", "replace").strip()
            yield out

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

def load_zip(zip_name, member_prefix):
    """Extract the dbf inside zip_name, return (path, member name) or None."""
    zp = ZIP_DIR / zip_name
    if not zp.exists():
        return None
    with zipfile.ZipFile(zp) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".dbf")]
        if not names:
            return None
        member = names[0]
        data = z.read(member)
    tmp = OUT_DIR.parent / ".freebuff" / "sync_tmp" / f"{member_prefix}-{zip_name.replace('.zip', '')}.dbf"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_bytes(data)
    return tmp

def main():
    buckets = {}
    total_weighted = 0.0
    total_raw = 0
    total_hh_raw = 0
    total_hh_weighted = 0.0
    files_done = 0
    zip_names = sorted(p.name for p in ZIP_DIR.glob("fard*.zip")) if ZIP_DIR.exists() else []
    if not zip_names:
        print("No census zips found under", ZIP_DIR)
        sys.exit(1)

    for zname in zip_names:
        idx = zname[4:6]  # "fard00.zip" -> "00"
        kh_name = f"kh{idx}.zip"
        fpath = load_zip(zname, "fard")
        if fpath is None:
            continue
        rec = {"persons": 0, "weighted": 0.0, "sex": collections.Counter(),
               "age": collections.Counter(), "urbanPersons": 0, "ruralPersons": 0,
               "unkPersons": 0}
        sizes = collections.Counter()
        fforms = collections.Counter()
        for r in read_dbf(fpath):
            rec["persons"] += 1
            w = num(r.get("w1")) or 0.0
            rec["weighted"] += w
            total_weighted += w
            total_raw += 1
            sex = str(r.get("col07") or "").strip()
            rec["sex"][sex if sex in ("1", "2") else "unknown"] += 1
            a = num(r.get("col10"))
            band = age_band(int(a)) if a is not None else None
            rec["age"][band or "unknown"] += 1
            ur = str(r.get("col40") or "").strip()
            if ur == "1":
                rec["urbanPersons"] += 1
            elif ur == "2":
                rec["ruralPersons"] += 1
            else:
                rec["unkPersons"] += 1
            form = r.get("FormNo")
            if form is not None:
                fforms[str(form)] += 1
        sizes = collections.Counter(fforms.values())

        kh = None
        if (ZIP_DIR / kh_name).exists():
            kpath = load_zip(kh_name, "kh")
            if kpath is not None:
                kh = {"households": 0, "weighted": 0.0, "urban": 0, "rural": 0,
                      "unk": 0, "hasWeight": False}
                for r in read_dbf(kpath):
                    kh["households"] += 1
                    w = num(r.get("w1")) or 0.0
                    if w:
                        kh["hasWeight"] = True
                    kh["weighted"] += w
                    ur = str(r.get("col40") or "").strip()
                    if ur == "1":
                        kh["urban"] += 1
                    elif ur == "2":
                        kh["rural"] += 1
                    else:
                        kh["unk"] += 1
                total_hh_raw += kh["households"]
                total_hh_weighted += kh["weighted"]

        buckets[idx] = {
            "persons": rec["persons"],
            "weightedPersons": round(rec["weighted"], 1),
            "sex": {k: v for k, v in rec["sex"].items()},
            "ageBands": {k: v for k, v in rec["age"].items()},
            "urbanPersons": rec["urbanPersons"],
            "ruralPersons": rec["ruralPersons"],
            "households": kh["households"] if kh else None,
            "weightedHouseholds": round(kh["weighted"], 1) if kh else None,
            "urbanHouseholds": kh["urban"] if kh else None,
            "ruralHouseholds": kh["rural"] if kh else None,
            "householdSize": {str(k): v for k, v in sorted(sizes.items())},
        }
        files_done += 1
        print(f"  {zname}: persons={rec['persons']} weighted={round(rec['weighted'])}"
              f" households={kh['households'] if kh else '-'}")

    # The sample's weighted total does not match any national census total,
    # and file indices are NOT provinces (col18 shows many provinces per file).
    # We keep the census year unknown unless the total clearly matches.
    if 65_000_000 < total_weighted < 76_000_000:
        census_year = 1385
    elif 55_000_000 < total_weighted <= 65_000_000:
        census_year = 1375
    else:
        census_year = None

    out = {
        "dataset": "census-microdata-sample",
        "censusYear": census_year,
        "censusYearNote": ("determined from weighted total ~%.1fM; 1385 ≈ 70.5M, 1375 ≈ 60M" % (total_weighted / 1e6))
        if census_year else "undetermined from weighted total %.1fM" % (total_weighted / 1e6),
        "source": "Portals/0/census/raw-data/cn_z (fardXX.zip + khXX.zip, weighted sample)",
        "files": files_done * 2,
        "weightColumn": "w1",
        "verifiedByCodebook": False,        "codebookNote": ("Columns are anonymous; sex=col07, age=col10, urban/rural=col40 were "
                          "identified by value distribution, not an official codebook. "
                          "File indices are NOT provinces (col18 carries استان+شهرستان codes for only about 12%% "
                          "of records, and a single file mixes provinces). The weighted total (%.1fM) "
                          "matches no national census, so the census year is unknown; treat these as "
                          "unidentified sample-area buckets.") % (total_weighted / 1e6),
        "totalRawPersons": total_raw,
        "totalWeightedPersons": round(total_weighted, 1),
        "totalHouseholds": total_hh_raw,
        "totalWeightedHouseholds": round(total_hh_weighted, 1) if total_hh_weighted else None,
        "buckets": buckets,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fname = f"census-{census_year}.json" if census_year else "census-unknown.json"
    outp = OUT_DIR / fname
    outp.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"done: {files_done} fard + {files_done} kh files; weighted pop={round(total_weighted):,}; "
          f"census year={census_year}; -> {outp.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
