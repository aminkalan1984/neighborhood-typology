# -*- coding: utf-8 -*-
"""Build the SCI numeric province-code -> {alpha, fa name} map for the backend.

Reads the already-extracted divisions-summary.json (numeric code + name) and
joins it to the app's alpha ids by normalized Persian name.
Output: server/data/province-map.json
"""
import io, json, pathlib, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = pathlib.Path(__file__).resolve().parent.parent

# App alpha ids (src/data/iranProvincePaths.ts) -> official Persian name
ALPHA_NAMES = [
    ("MRK", "مرکزی"), ("GIL", "گیلان"), ("MAZ", "مازندران"), ("EAZ", "آذربایجان شرقی"),
    ("WAZ", "آذربایجان غربی"), ("KRM", "کرمانشاه"), ("KHZ", "خوزستان"), ("FAR", "فارس"),
    ("KER", "کرمان"), ("KHR", "خراسان رضوی"), ("ISF", "اصفهان"), ("SIV", "سیستان و بلوچستان"),
    ("KRD", "کردستان"), ("HAM", "همدان"), ("CHB", "چهارمحال و بختیاری"), ("LUR", "لرستان"),
    ("ILM", "ایلام"), ("KHB", "کهگیلویه و بویراحمد"), ("BSH", "بوشهر"), ("ZAN", "زنجان"),
    ("SEM", "سمنان"), ("YAZ", "یزد"), ("HOR", "هرمزگان"), ("TEH", "تهران"),
    ("ARD", "اردبیل"), ("QOM", "قم"), ("QAZ", "قزوین"), ("GOL", "گلستان"),
    ("NKH", "خراسان شمالی"), ("SKH", "خراسان جنوبی"), ("ALB", "البرز"),
]

def norm(s):
    return s.replace("\u200c", "").replace("\u200f", "").replace(" ", "").strip()

summary_path = ROOT / "src" / "data" / "portals" / "divisions" / "divisions-summary.json"
summary = json.loads(summary_path.read_text(encoding="utf-8"))

by_norm = {norm(name): alpha for alpha, name in ALPHA_NAMES}
prov_map = {}
for row in summary:
    code = str(row["code"]).zfill(2)
    alpha = by_norm.get(norm(row["name"]), "")
    prov_map[code] = {"code": code, "alpha": alpha, "fa": row["name"]}

out_dir = ROOT / "server" / "data"
out_dir.mkdir(parents=True, exist_ok=True)
out = out_dir / "province-map.json"
out.write_text(json.dumps(prov_map, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"province-map: {len(prov_map)} provinces -> {out.relative_to(ROOT)}")
missing = [c for c, v in prov_map.items() if not v["alpha"]]
if missing:
    print("WARN unmapped:", missing)
else:
    print("all provinces mapped to alpha ids")
