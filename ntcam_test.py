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


class KeyFix(unittest.TestCase):
    """v1.1.1: key ke chhupe harf (AnyDesk paste) -> 400 bina wajah. Saaf karna + saaf ghalti."""
    def test_clean_key(self):
        self.assertEqual(ntcam.clean_key('\x16sk-ant-api03-Ab_9-xY\r\n \u200b'), 'sk-ant-api03-Ab_9-xY')
        self.assertEqual(ntcam.clean_key(None), '')

    def test_saved_key_saaf(self):
        ntcam.save_json(ntcam.SECRETS, {'claudeKey': 'sk-ant-api03-AAA\x16', 'cams': {}})
        self.assertEqual(ntcam.secrets()['claudeKey'], 'sk-ant-api03-AAA')
        self.assertEqual(ntcam.load_json(ntcam.SECRETS, {})['claudeKey'], 'sk-ant-api03-AAA', 'file mein bhi saaf')

    def _resp(self, code, body):
        class R:
            status_code = code
            text = body if isinstance(body, str) else json.dumps(body)
            def json(s):
                if isinstance(body, str):
                    raise ValueError('not json')
                return body
        return R()

    def test_api_error_texts(self):
        e = ntcam.api_error
        self.assertIn('chhupa ghalat harf', e(self._resp(400, '')))
        self.assertIn('credit nahi', e(self._resp(400, {'error': {'type': 'invalid_request_error', 'message': 'Your credit balance is too low'}})))
        self.assertIn('key ghalat', e(self._resp(401, {'error': {'message': 'invalid x-api-key'}})))
        self.assertEqual(e(self._resp(400, {'error': {'message': 'messages: bad'}})), 'Claude (400): messages: bad')

    def test_check_key_code(self):
        sent = {}
        def post(url, **k):
            sent['h'] = k['headers']['x-api-key']
            return self._resp(400, '')
        with mock.patch.dict(sys.modules, {'requests': types.SimpleNamespace(post=post)}):
            ok, msg, code = ntcam.check_key('sk-ant-api03-ZZ\x16')
        self.assertEqual((ok, code), (False, 400)); self.assertEqual(sent['h'], 'sk-ant-api03-ZZ', 'bhejte waqt bhi saaf')

    def test_version(self):
        self.assertTrue(ntcam.newer('1.1.1', '1.1'), 'PC khud naya le'); self.assertTrue(ntcam.newer(ntcam.VERSION, '1.1.1'))


class Milaan(unittest.TestCase):
    """v1.2 GALLA MILAAN — bill / payment se milana, baqaya, der se entry, POS band ho to alarm nahi."""
    S = {'kind': 'sale', 'no': '00119008', 'at': 1000.0, 'start': 970.0, 'amount': 1215.0, 'party': 'Cash'}
    P = {'kind': 'pay', 'no': 'p1', 'at': 2000.0, 'amount': 5000.0, 'party': 'Supplier X', 'who': 'Ali'}

    def test_pk_epoch(self):
        import datetime
        utc = datetime.datetime(2026, 9, 28, 13, 43, 2, tzinfo=datetime.timezone.utc).timestamp()
        self.assertEqual(ntcam.pk_epoch(datetime.datetime(2026, 9, 28, 18, 43, 2)), utc, '6:43:02 pm PK = 13:43:02 UTC')

    def test_match(self):
        m = ntcam.match
        self.assertEqual(m('aaya', 990, 1005, [self.S])[0], 'ok', 'bill 10 s baad save — theek')
        self.assertEqual(m('len_den', 1050, 1060, [self.S])[1]['no'], '00119008', 'baqaya ke sath')
        self.assertEqual(m('nikla', 995, 1004, [self.S])[0], 'ok', 'baqaya dena "nikla" lagta hai — bill ho to theek')
        self.assertEqual(m('nikla', 1990, 2003, [self.S, self.P])[1]['kind'], 'pay', 'de diye pehle')
        self.assertEqual(m('aaya', 1500, 1510, [self.S])[0], 'wait', 'door ka bill nahi')
        self.assertEqual(m('ginti', 990, 1005, [])[0], 'none')
        self.assertEqual(m('aaya', 1500, 1510, [], pos_ok=False)[0], 'nopos', 'POS parh na sake to alarm nahi')
        self.assertEqual(m('nikla', 1500, 1510, [], True, False)[0], 'nopos')

    def test_context_and_flow(self):
        c = ntcam.context_text([self.S, self.P])
        self.assertIn('Bill #00119008 Rs 1,215', c); self.assertIn('Supplier X ko Rs 5,000 de diye', c)
        self.assertIn('NAHI', ntcam.context_text([]))
        self.assertEqual(ntcam.parse_flow('{"flow":"len_den","verdict":"normal","why":"baqaya diya"}'), ('len_den', 'normal', 'baqaya diya'))
        self.assertEqual(ntcam.parse_flow('{"flow":"udaa","verdict":"x"}')[:2], ('saaf_nahi', 'saaf_nahi'))
        self.assertIn('haath seene', ntcam.GALLA_PROMPT2, 'seene par haath shak nahi')

    def _g(self, recs, ok=True):
        writes = []
        class F:
            def get(s, path): return None
            def patch(s, path, data): writes.append((path, data)); return True
            def query(s, *a, **k): return [{'why': 'haath jeb ki taraf', 'verdict': 'shak', 'reviewed': 'ok', 'reviewNote': 'qalam rakha', 'at': 5}]
        pos = types.SimpleNamespace(near=lambda a, b: [r for r in recs if a <= r['at'] <= b], ok_sql=lambda: ok, ok_bk=lambda: ok)
        return ntcam.Galla(F(), pos), writes

    def test_handle_bill_milaan_aur_misaal(self):
        import numpy as np
        g, writes = self._g([self.S])
        seen = {}
        def judge(key, crops, ctx, gap, ex=''):
            seen.update(ctx=ctx, ex=ex, n=len(crops)); return 'len_den', 'normal', 'paisa liya, baqaya diya', 700
        w = types.SimpleNamespace(cid='c1', name='Galla', cap_day=300)
        fr = [(np.random.rand(120, 160, 3) * 255).astype('uint8') for _ in range(10)]
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), mock.patch.object(ntcam, 'ai_judge2', judge):
            g.handle(w, 995.0, 991.0, 1008.0, fr)
        self.assertIn('Bill #00119008', seen['ctx'], 'AI ko bill bataya'); self.assertIn('qalam rakha', seen['ex'], 'malik ki misaal'); self.assertEqual(seen['n'], 10)
        ev = [d for p, d in writes if '/cameraEvents/' in p][0]
        self.assertEqual((ev['flow'], ev['matchState'], ev['match']['no'], ev['match']['amount']), ('len_den', 'ok', '00119008', 1215.0))
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        blk = rules[rules.index('cameraEvents/{eventId}'):]; blk = blk[:blk.index('\n    }')]
        for k in ev: self.assertIn("'" + k + "'", blk, 'rules mein nahi: ' + k)
        st = g.stats[('c1', ntcam.pk_date(995.0))]; self.assertEqual((st['moneyIn'], st['matched']), (1, 1))

    def test_wait_phir_ok_ya_missing(self):
        import numpy as np
        recs = []
        g, writes = self._g(recs)
        w = types.SimpleNamespace(cid='c1', name='Galla', cap_day=300)
        fr = [(np.random.rand(120, 160, 3) * 255).astype('uint8') for _ in range(4)]
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_judge2', lambda *a: ('aaya', 'normal', 'paisa galla mein rakha', 500)):
            g.handle(w, 3000.0, 2996.0, 3006.0, fr)
            g.handle(w, 4000.0, 3996.0, 4006.0, fr)
        evs = [d for p, d in writes if '/cameraEvents/' in p]; self.assertEqual([e['matchState'] for e in evs], ['wait', 'wait'])
        recs.append({'kind': 'sale', 'no': 'late1', 'at': 3040.0, 'amount': 500.0, 'party': ''})   # bill der se bana
        g.recheck()
        upd = [(p, d) for p, d in writes if '/cameraEvents/' in p and 'matchAt' in d]
        self.assertEqual(upd[0][1]['matchState'], 'ok'); self.assertEqual(upd[0][1]['match']['no'], 'late1')
        self.assertEqual(len(g.waiting), 1, 'doosra ab bhi intezar mein')
        g.waiting[0]['made'] -= 400; g.recheck()
        self.assertEqual([d for p, d in writes if 'matchAt' in d][-1]['matchState'], 'missing'); self.assertEqual(g.waiting, [])
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        self.assertIn("affectedKeys().hasOnly(['matchState', 'match', 'matchAt'])", rules)


class BillBadla(unittest.TestCase):
    """v1.3 — bill cancel / raqam kam / items badle -> posAlerts, replacedBy, camera card par chip."""
    def _pos(self):
        import datetime
        writes = []
        class F:
            def get(s, path): return {'match': {'kind': 'sale', 'no': '00119008', 'amount': 9000.0}} if 'cameraEvents' in path else None
            def patch(s, path, data): writes.append((path, data)); return True
        p = ntcam.Pos(F()); p.users = {8: 'Ali'}
        g = types.SimpleNamespace(by_bill={'00119008': 'cam-ev-1'}, bump=lambda cid, d, **kv: writes.append(('bump', (cid, kv))))
        p.galla = g
        base = datetime.datetime.utcfromtimestamp(time_now() + 5 * 3600 - 600).replace(second=0, microsecond=0)   # PK ka sada waqt, 10 min pehle
        d = lambda m: base + datetime.timedelta(minutes=m)
        row = lambda sid, no, total, st, mins, n=1, h=11, upd=None: {'SaleID': sid, 'SaleNo': no, 'CreatedOn': d(mins), 'UpdatedOn': d(upd) if upd else None, 'CreatedBy': 8, 'UpdatedBy': 8 if upd else None, 'TotalSale': total, 'DocStatusID': st, 'n': n, 'h': h}
        return p, writes, row

    def test_cancel_phir_naya_sasta_bill(self):
        p, writes, row = self._pos()
        p.watch_bills({1: row(1, '00119008', 9000, 2, 5)})
        self.assertEqual(p.alerts, {}, 'pehli dafa dekha — alert nahi')
        p.watch_bills({1: row(1, '00119008', 9000, 3, 5, upd=7)})                       # cancel
        self.assertEqual(len(p.alerts), 1); a = list(p.alerts.values())[0]
        self.assertEqual((a['kind'], a['no'], a['before'], a['after'], a['by'], a['eventId']), ('cancel', '00119008', 9000.0, 0.0, 'Ali', 'cam-ev-1'))
        pa = [d for pth, d in writes if isinstance(pth, str) and '/posAlerts/' in pth]; self.assertEqual(pa[0]['kind'], 'cancel'); self.assertEqual(pa[0]['amount'], 9000.0)
        ev = [d for pth, d in writes if isinstance(pth, str) and '/cameraEvents/cam-ev-1' in pth][0]
        self.assertEqual((ev['match']['changed'], ev['match']['after']), ('cancel', 0.0), 'camera card par chip')
        self.assertIn(('bump', ('pos', {'alerts': 1})), writes)
        p.watch_bills({1: row(1, '00119008', 9000, 3, 5, upd=7), 2: row(2, '00119009', 100, 2, 9)})   # 2 min baad naya sasta
        self.assertEqual(a['replacedBy']['no'], '00119009'); self.assertEqual(a['replacedBy']['amount'], 100.0)
        p.watch_bills({1: row(1, '00119008', 9000, 3, 5, upd=7), 2: row(2, '00119009', 100, 2, 9)})
        self.assertEqual(len(p.alerts), 1, 'dobara alert nahi')
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        blk = rules[rules.index('posAlerts/{alertId}'):]; blk = blk[:blk.index('\n    }')]
        for k in pa[-1]: self.assertIn("'" + k + "'", blk, 'rules mein nahi: ' + k)

    def test_edit_aur_items(self):
        p, writes, row = self._pos()
        p.watch_bills({1: row(1, 'A', 9000, 2, 5), 2: row(2, 'B', 500, 2, 6, n=2, h=77)})
        p.watch_bills({1: row(1, 'A', 100, 2, 5, upd=8), 2: row(2, 'B', 500, 2, 6, n=2, h=78)})
        kinds = sorted(a['kind'] for a in p.alerts.values()); self.assertEqual(kinds, ['edit', 'items'])
        e = [a for a in p.alerts.values() if a['kind'] == 'edit'][0]; self.assertEqual((e['before'], e['after']), (9000.0, 100.0))
        p.watch_bills({1: row(1, 'A', 100, 2, 5, upd=8), 2: row(2, 'B', 500, 2, 6, n=2, h=78), 3: row(3, 'C', 12000, 2, 9)})
        self.assertNotIn('replacedBy', e, 'mehnga bill "iski jagah" nahi')


class Nigrani(unittest.TestCase):
    """v1.1 galla nigrani — harkat, tukre, AI faisla, ginti (bina camera / Claude ke)."""
    def test_zone_px(self):
        self.assertEqual(ntcam.zone_px({'x': .25, 'y': .5, 'w': .5, 'h': .25}, 800, 400), (200, 200, 600, 300))
        x0, y0, x1, y1 = ntcam.zone_px({'x': .25, 'y': .5, 'w': .5, 'h': .25}, 800, 400, 0.5)
        self.assertEqual((x0, y0, x1, y1), (0, 150, 800, 350), 'AI ke liye aas paas bhi, tasveer se bahar nahi')
        self.assertEqual(ntcam.zone_px(None, 10, 10), (0, 0, 0, 0))

    def test_motion(self):
        import numpy as np
        m = ntcam.Motion('mid')
        still = np.full((120, 200, 3), 90, 'uint8')
        self.assertFalse(m.feed(still)[0])
        for _ in range(5):
            self.assertFalse(m.feed(still)[0], 'khamoshi par harkat nahi')
        moved = still.copy(); moved[20:100, 40:160] = 230          # haath aaya
        self.assertFalse(m.feed(moved)[0], 'aik sample par nahi (shor)')
        self.assertTrue(m.feed(moved)[0], 'do lagatar = harkat')

    def test_pick_and_verdict(self):
        self.assertEqual(ntcam.pick(list(range(10)), 6), [0, 2, 4, 5, 7, 9]); self.assertEqual(len(ntcam.pick(list(range(40)), 10)), 10)
        self.assertEqual(ntcam.parse_verdict('ok {"verdict": "shak", "why": "Note jeb mein"} bas'), ('shak', 'Note jeb mein'))
        self.assertEqual(ntcam.parse_verdict('{"verdict":"Normal","why":"baqaya diya"}')[0], 'normal')
        self.assertEqual(ntcam.parse_verdict('samajh nahi aaya')[0], 'saaf_nahi')
        self.assertEqual(ntcam.pk_date(0), '1970-01-01')

    def _galla(self):
        import numpy as np
        writes = []
        class F:
            def get(s, path): return None
            def patch(s, path, data): writes.append((path, data)); return True
        g = ntcam.Galla(F())
        w = types.SimpleNamespace(cid='aa11-ch1', name='Galla', cap_day=2)
        frames = [(np.random.rand(200, 300, 3) * 255).astype('uint8') for _ in range(6)]
        return g, w, frames, writes

    def test_galla_flow(self):
        g, w, frames, writes = self._galla()
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_judge2', lambda key, crops, ctx, gap, ex='': ('kuch_nahi', 'shak', 'Note jeb ki taraf', 900)):
            g.handle(w, 1000.0, 996.0, 1005.0, frames)  # jaanch
            g.handle(w, 1010.0, 1006.0, 1012.0, frames) # 20 s ke andar: sirf ginti
            g.handle(w, 1031.0, 1027.0, 1036.0, frames) # doosri jaanch
            g.handle(w, 1060.0, 1056.0, 1065.0, frames) # had (2) poori: ginti + unchecked
        st = g.stats[('aa11-ch1', ntcam.pk_date(1000.0))]
        self.assertEqual((st['touches'], st['checks'], st['shak'], st['unchecked']), (4, 2, 2, 1))
        ev = [d for p, d in writes if '/cameraEvents/' in p]; fr = [d for p, d in writes if '/cameraFrames/' in p]
        self.assertEqual(len(ev), 2); self.assertEqual(len(fr), 2)
        self.assertEqual(ev[0]['verdict'], 'shak'); self.assertEqual(len(fr[0]['frames']), 6); self.assertEqual(ev[0]['matchState'], 'none')
        self.assertLess(len(ev[0]['thumb']), 80000, 'rules ki had'); self.assertLess(sum(len(x) for x in fr[0]['frames']), 900000, 'Firestore 1 MB')
        order = [p.split('/')[2] for p, d in writes]
        self.assertEqual(order[:2], ['cameraFrames', 'cameraEvents'], 'pehle tasveerein, phir event (event par khabar jati hai)')
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        blk = rules[rules.index('cameraEvents/{eventId}'):]; blk = blk[:blk.index('\n    }')]
        for k in ev[0]: self.assertIn("'" + k + "'", blk, 'rules mein nahi: ' + k)
        card = [d for p, d in writes if p.endswith('/cameras/aa11-ch1')]
        self.assertTrue(card and card[-1]['aiTest'].startswith('AI chal raha hai — aakhri jaanch'), 'v1.1.2: card ki AI line taaza')
        self.assertIn('(Shak)', card[-1]['aiTest'])
        g.flush()
        sw = [d for p, d in writes if '/cameraStats/' in p][0]
        rb = rules[rules.index('cameraStats/{statId}'):]; rb = rb[:rb.index('\n    }')]
        for k in sw: self.assertIn("'" + k + "'", rb, 'stats rules mein nahi: ' + k)

    def test_ai_error_pause(self):
        g, w, frames, writes = self._galla()
        def boom(*a): raise RuntimeError('credit nahi')
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), mock.patch.object(ntcam, 'ai_judge2', boom):
            g.handle(w, 2000.0, 1996.0, 2005.0, frames)
        ev = [d for p, d in writes if '/cameraEvents/' in p][0]
        self.assertEqual(ev['verdict'], 'error'); self.assertIn('credit', ev['why'])
        self.assertGreater(g.pause_until, time_now() - 1)

    def test_watch_wanted(self):
        c = {'role': 'galla', 'zone': {'w': .3}, 'enabled': True}
        self.assertTrue(ntcam.watch_wanted(c, {'url': 'x'}))
        self.assertFalse(ntcam.watch_wanted({**c, 'zone': None}, {'url': 'x'}), 'dabba nahi')
        self.assertFalse(ntcam.watch_wanted({**c, 'role': 'view'}, {'url': 'x'}))
        self.assertFalse(ntcam.watch_wanted({**c, 'enabled': False}, {'url': 'x'}))
        self.assertFalse(ntcam.watch_wanted(c, None), 'password nahi')


def time_now():
    import time
    return time.time()


if __name__ == '__main__':
    unittest.main(verbosity=1)
