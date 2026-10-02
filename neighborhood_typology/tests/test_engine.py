import csv, json, math, subprocess, sys, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from typology_engine import scenario, domain_label, aggregate
class EngineTests(unittest.TestCase):
 def test_document_geometric_mean_examples(self):
  self.assertAlmostEqual((1.0*3.5*4.8)**(1/3),2.56,places=2)
  self.assertAlmostEqual((2.5*1.5*1.2)**(1/3),1.65,places=2)
  self.assertAlmostEqual((4.0*2.5*4.5)**(1/3),3.56,places=2)
 def test_domain_labels(self):
  self.assertEqual(domain_label('physical',1.9),'نهفته')
  self.assertEqual(domain_label('behavioral',3.0),'مستعد تعامل')
  self.assertEqual(domain_label('normative',4.2),'پیشرو')
 def test_scenarios(self):
  self.assertEqual(scenario(4.2,4.1,1.8)['pattern'],'HHL')
  self.assertEqual(scenario(4.2,4.1,4.4)['label'],'پیشران متوازن')
 def test_malformed_measurements_never_certify_or_crash(self):
  registry=[
   {'code':'PHY-001','domain':'physical','driver_id':'P1','domain_weight_percent':'100'},
   {'code':'BEH-001','domain':'behavioral','driver_id':'B1','domain_weight_percent':'100'},
   {'code':'NOR-001','domain':'normative','driver_id':'N1','domain_weight_percent':'100'},
  ]
  result=aggregate(registry,[
   {'code':'PHY-001','score_1_5':'not-a-number','status':'measured'},
   {'code':'BEH-001','score_1_5':'3','status':'unexpected'},
   {'code':'NOR-001','score_1_5':'4','status':'validated','quality_score':'0.9','formula_version':'NOR-001@1.0'},
   {'code':'NOR-001','score_1_5':'4','status':'validated','quality_score':'0.9','formula_version':'NOR-001@1.0'},
   {'code':'UNKNOWN','score_1_5':'3','status':'validated'},
  ])
  self.assertEqual(result['status'],'provisional')
  self.assertFalse(result['certification_gates']['eligible'])
  self.assertTrue(result['invalid_measurements'])
  self.assertTrue(result['evidence_failures'])
if __name__=='__main__': unittest.main()
