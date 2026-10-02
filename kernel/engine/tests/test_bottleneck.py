"""CONTRACT tests for the Bottleneck Detection Engine (engine/bottleneck.py).
Synthetic fixtures only; never presented as a neighborhood result."""
import os, sys, inspect
KROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, KROOT)
from engine import bottleneck as B
from engine.bottleneck import detect_bottleneck

passed = 0; total = 0
def check(name, cond):
    global passed, total
    total += 1
    print(("PASS " if cond else "FAIL ") + name)
    if cond: passed += 1

def stage(v): return {"value": v, "status": "OBSERVED"}
def absent(): return {"value": None, "status": "INSUFFICIENT_COVERAGE"}

# (a) low-C fixture => base-deficiency flagged BEFORE largest gap.
# Here the largest gap is E-O (70-20=50) but C=35 is below threshold => base deficiency wins.
low_c = {"C": stage(35.0), "A": stage(80.0), "U": stage(75.0), "E": stage(70.0), "O": stage(20.0)}
r_a = detect_bottleneck(low_c, base_threshold=60.0)
check("(a) low C flags base_deficiency", r_a["base_deficiency"]["flagged"] is True)
check("(a) primary bottleneck is base_deficiency (NOT the largest gap E-O)",
      r_a["primary_bottleneck"]["type"] == "base_deficiency" and r_a["primary_bottleneck"]["stage"] == "C")
check("(a) largest gap E-O still present in ranking but not chosen as primary",
      r_a["gap_ranking"][0]["gap"] == "G_EO" and r_a["primary_bottleneck"]["type"] != "chain_gap")

# (b) all-stages-present, C healthy => gaps ranked correctly, largest is primary
healthy = {"C": stage(90.0), "A": stage(60.0), "U": stage(58.0), "E": stage(55.0), "O": stage(54.0)}
# gaps: C-A=30, A-U=2, U-E=3, E-O=1 => largest abs is G_CA=30
r_b = detect_bottleneck(healthy, base_threshold=60.0)
check("(b) no base deficiency when C healthy", r_b["base_deficiency"]["flagged"] is False)
check("(b) gaps ranked correctly, largest G_CA=30 is primary",
      r_b["gap_ranking"][0]["gap"] == "G_CA" and r_b["primary_bottleneck"]["gap"] == "G_CA")
check("(b) chain gap values exact: G_CA=30, A-U=2", r_b["chain_gaps"]["G_CA"]["value"] == 30.0
      and r_b["chain_gaps"]["G_AU"]["value"] == 2.0)

# (c) insufficient-coverage fixture => abstains, no fabricated bottleneck
insufficient = {"C": absent(), "A": absent(), "U": absent(), "E": absent(), "O": absent()}
r_c = detect_bottleneck(insufficient)
check("(c) all-abstained => INSUFFICIENT_COVERAGE", r_c["status"] == "INSUFFICIENT_COVERAGE")
check("(c) NO fabricated bottleneck", r_c["primary_bottleneck"] is None)
check("(c) states exactly what data is needed", len(r_c["needed_data"]) >= 1)

# (d) deterministic
r_d1 = detect_bottleneck(low_c, base_threshold=60.0)
r_d2 = detect_bottleneck(low_c, base_threshold=60.0)
check("(d) deterministic (identical output)", r_d1 == r_d2)

# (e) AI-independent: pure function of scores — signature has NO model/llm/client params,
#     module imports no LLM/network client, and flag is set.
sig = set(inspect.signature(detect_bottleneck).parameters.keys())
check("(e) signature takes only scores/config (no model/llm/client)",
      not (sig & {"model", "llm", "client", "prompt", "api_key"}))
src = inspect.getsource(B)
check("(e) module makes no network/LLM import", not any(x in src for x in
      ["import openai", "import anthropic", "requests.get", "requests.post", "urllib", "http"]))
check("(e) result flags ai_independent=True", r_b["ai_independent"] is True)

print(f"\nBOTTLENECK CONTRACT TESTS: {passed}/{total} passed")
sys.exit(0 if passed == total else 1)
