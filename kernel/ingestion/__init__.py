"""kernel.ingestion — MVP-1 Real Data Ingestion Service.

Adds multi-format import, structured validators, full provenance/lineage, a
manual-approval workflow, and the calculation GATE that blocks INVALID/missing
data. Reuses (never duplicates) engine.status.Measurement and
engine.provenance.reproducibility_key. No mock/fake/sample data anywhere.
"""
