"""Provenance drill-down + reproducibility key. Constraint 3,8."""
from dataclasses import dataclass, field
from typing import List, Dict, Any

@dataclass
class Result:
    name: str
    value: Any
    status: str
    formula_id: str
    inputs: List[str] = field(default_factory=list)
    sources: List[str] = field(default_factory=list)
    versions: Dict[str,str] = field(default_factory=dict)
    note: str = ""
    def as_dict(self):
        return self.__dict__

def reproducibility_key(data_v, methodology_v, indicator_v, weight_v, threshold_v, calc_v):
    """Constraint 8: every published result reproducible from these 6 versions."""
    return {"data_version":data_v,"methodology_version":methodology_v,
            "indicator_version":indicator_v,"weight_set":weight_v,
            "threshold_set":threshold_v,"calculation_version":calc_v}
