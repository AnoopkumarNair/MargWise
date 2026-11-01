import json, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


class CitiesMatchContract(unittest.TestCase):
    def test_ids_match_bands(self):
        bands = json.loads((ROOT / 'contracts/bands.json').read_text())
        cities = json.loads((ROOT / 'data/graph/raw/cities.json').read_text())
        ids = [c['id'] for c in cities['clusters']]
        self.assertEqual(ids, bands['city_cluster']['values'])
        for c in cities['clusters']:
            self.assertTrue(c['label'])
            if c['id'] != 'city:other':
                self.assertTrue(c['state'])


if __name__ == '__main__':
    unittest.main()
