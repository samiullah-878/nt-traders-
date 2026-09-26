# ntcam_test.py — PC ke camera program ki jaanch (bina asal camera / Firebase ke).  Chalana:  python ntcam_test.py
import os, sys, json, base64, tempfile, types, unittest
from unittest import mock
os.environ['NTCAM_HOME'] = tempfile.mkdtemp()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ntcam


class T(unittest.TestCase):
    def test_pc_code(self):
        self.assertEqual(ntcam.parse_code(' K7M2QX-9fa4tpze3h '), ('cam-k7m2qx@nttraders.local', '9fa4tpze3h'))
        self.assertIsNone(ntcam.parse_code('abc'))
        self.assertIsNone(ntcam.parse_code('k7m2qx9fa4tpze3h'))

    def test_firestore_values(self):
        v = {'a': 1, 'b': 'x', 'c': True, 'd': None, 'e': 1.5, 'f': [1, 'y'], 'g': {'h': 2}}
        self.assertEqual({k: ntcam.dec(ntcam.enc(x)) for k, x in v.items()}, v)
        self.assertEqual(ntcam.enc(5), {'integerValue': '5'})

    def test_rtsp_and_mask(self):
        u = ntcam.rtsp_urls('dahua', '192.168.0.9', 'admin', 'p@ss:w/rd#1', 2)
        self.assertEqual(u[0], 'rtsp://admin:p%40ss%3Aw%2Frd%231@192.168.0.9:554/cam/realmonitor?channel=2&subtype=0')
        self.assertTrue(ntcam.rtsp_urls('hik', '1.2.3.4', 'a', 'b')[0].endswith('/Streaming/Channels/101'))
        self.assertNotIn('p%40ss', ntcam.mask(u[0])); self.assertIn('****@192.168.0.9', ntcam.mask(u[0]))

    def test_jpeg(self):
        import numpy as np
        f = (np.random.rand(1440, 2560, 3) * 255).astype('uint8')
        b64, w, h = ntcam.jpeg_b64(f)
        self.assertEqual((w, h), (640, 360)); self.assertLess(len(b64), 400000, 'rules ki had (400 KB) se kam')
        self.assertTrue(base64.b64decode(b64)[:2] == b'\xff\xd8', 'asli jpeg')

    def test_newer(self):
        self.assertTrue(ntcam.newer('1.10', '1.9')); self.assertFalse(ntcam.newer('1.0', '1.0')); self.assertTrue(ntcam.newer('2.0', '1.0'))

    def test_patch_sirf_apni_fields(self):
        calls = []
        class R:
            def __init__(s, code=200, j=None): s.status_code, s._j, s.text = code, j or {}, ''
            def json(s): return s._j
        fake = types.SimpleNamespace(
            post=lambda url, **k: R(200, {'idToken': 'T', 'refreshToken': 'R', 'localId': 'U', 'expiresIn': '3600'}),
            patch=lambda url, headers=None, params=None, json=None, timeout=None: calls.append((url, params, json)) or R(),
            get=lambda *a, **k: R(404))
        with mock.patch.dict(sys.modules, {'requests': fake}):
            f = ntcam.Fire('K', 'nt-traders', 'cam-x@nttraders.local', 'p')
            f.patch('businesses/noor-traders/cameras/abc-ch1', {'status': 'online', 'lastFrameAt': 5})
            self.assertIsNone(f.get('businesses/noor-traders/cameras/none'))
        url, params, body = calls[0]
        self.assertTrue(url.endswith('/documents/businesses/noor-traders/cameras/abc-ch1'))
        self.assertEqual(sorted(p[1] for p in params), ['lastFrameAt', 'status'], 'updateMask — malik ka naam/kaam nahi badalta')
        self.assertEqual(body['fields']['lastFrameAt'], {'integerValue': '5'})

    def test_agent_keys_rules_mein(self):
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        block = rules[rules.index('match /businesses/noor-traders/cameras/{camId}'):]
        block = block[:block.index('}\n')]
        for k in ntcam.AGENT_KEYS:
            self.assertIn("'" + k + "'", block, 'rules mein nahi: ' + k)


if __name__ == '__main__':
    unittest.main(verbosity=1)
