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

    CRV = {'kind': 'crv', 'no': 'v9', 'bill': '00119008', 'at': 1054.0, 'amount': 1215.0, 'party': 'Cash', 'who': 'waqar', 'billAt': 1000.0}

    def test_match(self):
        """v1.6: galla SIRF voucher par — bill ka banna kafi nahi; Cash Received voucher se 60 s pehle .. 90 s baad tak jaiz."""
        m = ntcam.match
        self.assertEqual(m('aaya', 990, 1005, [self.S])[0], 'wait', 'sirf bill bana, voucher nahi -> intezar (phir missing)')
        self.assertEqual(m('len_den', 1030, 1040, [self.S, self.CRV])[1]['kind'], 'crv', 'voucher (1054) se 60 s pehle tak len-den usi ka')
        self.assertEqual(m('nikla', 1140, 1150, [self.S, self.CRV])[0], 'ok', 'voucher ke 90 s baad tak baqaya')
        self.assertEqual(m('nikla', 1150, 1160, [self.S, self.CRV])[0], 'wait', 'voucher ke 90 s BAAD nikla = bina voucher (5000 kisi aur ko)')
        self.assertEqual(m('aaya', 900, 990, [self.S, self.CRV])[0], 'wait', 'voucher se 60 s se zyada pehle nahi')
        self.assertEqual(m('nikla', 1990, 2003, [self.S, self.P])[1]['kind'], 'pay', 'Galla screen de diye pehle')
        self.assertEqual(m('ginti', 990, 1005, [], khula=False)[0], 'none', 'galla khula hi nahi, sirf haath mein gine')
        self.assertEqual(m('ginti', 990, 1005, [], khula=True)[0], 'wait', 'galla khol kar ginti, voucher nahi -> shak ki taraf')
        self.assertEqual(m('kuch_nahi', 990, 1005, [self.CRV])[0], 'none')
        self.assertEqual(m('aaya', 1500, 1510, [], pos_ok=False)[0], 'nopos', 'POS parh na sake to alarm nahi')
        self.assertEqual(m('nikla', 1500, 1510, [], True, False)[0], 'nopos')
        # POS mein voucher ka khana na mile (vouchers=False): bill ke waqt se, thora khula (scan -30 .. post +120)
        self.assertEqual(m('aaya', 990, 1005, [self.S], vouchers=False)[0], 'ok')
        self.assertEqual(m('nikla', 1100, 1110, [self.S], vouchers=False)[1]['no'], '00119008', 'post ke 120 s tak')
        self.assertEqual(m('nikla', 1130, 1140, [self.S], vouchers=False)[0], 'wait')
        w = ntcam.window(self.CRV); self.assertEqual(w, (994.0, 1144.0))
        self.assertEqual(ntcam.window({'kind': 'pay', 'at': 2000.0}), (1880.0, 2120.0))

    def test_context_and_flow(self):
        c = ntcam.context_text([self.S, self.P])
        self.assertIn('Bill #00119008 Rs 1,215', c); self.assertIn('Supplier X ko Rs 5,000 de diye', c)
        self.assertIn('NAHI', ntcam.context_text([]))
        self.assertEqual(ntcam.parse_flow('{"flow":"len_den","verdict":"normal","why":"baqaya diya"}'), ('len_den', 'normal', 'baqaya diya'))
        self.assertEqual(ntcam.parse_flow('{"flow":"udaa","verdict":"x"}')[:2], ('saaf_nahi', 'saaf_nahi'))
        self.assertIn('haath seene', ntcam.GALLA_PROMPT2, 'seene par haath shak nahi')
        self.assertIn('note ginne wali machine', ntcam.GALLA_PROMPT3, 'v1.6: dukaan ka tareeqa AI ko bataya')
        self.assertEqual(ntcam.parse_khula('{"flow":"ginti","khula": false,"verdict":"normal"}'), False)
        self.assertEqual(ntcam.parse_khula('{"khula":true}'), True); self.assertIsNone(ntcam.parse_khula('{"flow":"aaya"}'))
        c2 = ntcam.context_text([self.S, self.CRV])
        self.assertIn('CASH RECEIVED voucher: Bill #00119008', c2); self.assertNotIn('abhi Cash Received nahi', c2, 'voucher aa gaya to bill "pending" nahi')
        self.assertIn('galle par abhi Cash Received nahi', ntcam.context_text([self.S]), 'bill bana, cash abhi nahi')
        self.assertEqual(ntcam.match_doc(self.CRV)['bill'], '00119008'); self.assertEqual(ntcam.match_doc(self.CRV)['billAt'], 1000000)

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
            seen.update(ctx=ctx, ex=ex, n=len(crops)); return 'len_den', 'normal', 'paisa liya, baqaya diya', 700, True
        w = types.SimpleNamespace(cid='c1', name='Galla', cap_day=300)
        fr = [(np.random.rand(120, 160, 3) * 255).astype('uint8') for _ in range(10)]
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), mock.patch.object(ntcam, 'ai_judge2', judge):
            g.handle(w, 995.0, 991.0, 1008.0, fr)
        self.assertIn('Bill #00119008', seen['ctx'], 'AI ko bill bataya'); self.assertIn('qalam rakha', seen['ex'], 'malik ki misaal'); self.assertEqual(seen['n'], 10)
        ev = [d for p, d in writes if '/cameraEvents/' in p][0]
        self.assertEqual((ev['flow'], ev['matchState'], ev['match']['no'], ev['match']['amount']), ('len_den', 'ok', '00119008', 1215.0), 'voucher ka khana na ho (fake pos) to bill ke waqt se')
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        blk = rules[rules.index('cameraEvents/{eventId}'):]; blk = blk[:blk.index('\n    }')]
        for k in ev: self.assertIn("'" + k + "'", blk, 'rules mein nahi: ' + k)
        st = g.stats[('c1', ntcam.pk_date(995.0))]; self.assertEqual((st['moneyIn'], st['matched']), (1, 1))

    def test_wait_phir_ok_ya_missing(self):
        import numpy as np
        recs = []
        g, writes = self._g(recs)
        clips = []
        g.clips = types.SimpleNamespace(shak=lambda cid, eid, t0, t1, date: clips.append((eid, t0, t1)))
        w = types.SimpleNamespace(cid='c1', name='Galla', cap_day=300)
        fr = [(np.random.rand(120, 160, 3) * 255).astype('uint8') for _ in range(4)]
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_judge2', lambda *a: ('aaya', 'normal', 'paisa galla mein rakha', 500)):   # purana 4-tuple bhi chale
            g.handle(w, 3000.0, 2996.0, 3006.0, fr)
            g.handle(w, 4000.0, 3996.0, 4006.0, fr)
        evs = [d for p, d in writes if '/cameraEvents/' in p]; self.assertEqual([e['matchState'] for e in evs], ['wait', 'wait'])
        recs.append({'kind': 'sale', 'no': 'late1', 'at': 3020.0, 'start': 3000.0, 'amount': 500.0, 'party': ''})   # bill der se POS mein aaya (voucher ka khana nahi -> bill se)
        g.recheck()
        upd = [(p, d) for p, d in writes if '/cameraEvents/' in p and 'matchAt' in d]
        self.assertEqual(upd[0][1]['matchState'], 'ok'); self.assertEqual(upd[0][1]['match']['no'], 'late1')
        self.assertEqual(len(g.waiting), 1, 'doosra ab bhi intezar mein')
        g.waiting[0]['made'] -= 130; g.recheck()
        self.assertEqual([d for p, d in writes if 'matchAt' in d][-1]['matchState'], 'missing', '2 minute baad missing'); self.assertEqual(g.waiting, [])
        self.assertEqual(clips, [('c1-4000000', 3996.0, 4006.0)], 'v1.6: bina voucher galla khula -> clip bhi')
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        self.assertIn("affectedKeys().hasOnly(['matchState', 'match', 'matchAt'])", rules)

    def test_voucher_mode_bill_kafi_nahi(self):
        """v1.6: voucher ka khana mil gaya -> bill bana hona kafi nahi; Cash Received voucher der se aaye to ok, na aaye to missing."""
        import numpy as np
        recs = [dict(self.S)]
        g, writes = self._g(recs)
        g.pos.vch_ok = lambda: True
        clips = []
        g.clips = types.SimpleNamespace(shak=lambda cid, eid, t0, t1, date: clips.append(eid))
        w = types.SimpleNamespace(cid='c1', name='Galla', cap_day=300)
        fr = [(np.random.rand(120, 160, 3) * 255).astype('uint8') for _ in range(4)]
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_judge2', lambda *a: ('len_den', 'normal', 'liya, baqaya diya', 500, True)):
            g.handle(w, 1010.0, 1005.0, 1020.0, fr)        # bill 1000 par bana, voucher abhi nahi
            g.handle(w, 1400.0, 1395.0, 1410.0, fr)        # koi record nahi
        evs = [d for p, d in writes if '/cameraEvents/' in p]; self.assertEqual([e['matchState'] for e in evs], ['wait', 'wait'], 'bill bana hona kafi nahi')
        recs.append(dict(self.CRV))                        # Cash Received voucher 1054 par aaya (POS 20 s mein likhta hai)
        g.recheck()
        upd = [d for p, d in writes if '/cameraEvents/' in p and 'matchAt' in d]
        self.assertEqual((upd[0]['matchState'], upd[0]['match']['kind'], upd[0]['match']['bill']), ('ok', 'crv', '00119008'))
        g.waiting[0]['made'] -= 130; g.recheck()
        self.assertEqual([d for p, d in writes if 'matchAt' in d][-1]['matchState'], 'missing'); self.assertEqual(clips, ['c1-1400000'])


class EkLenDen(unittest.TestCase):
    """v1.7 — qareeb harkatein aik len-den (aik AI jaanch), shak ki doosri raaye (Sonnet)."""
    W = types.SimpleNamespace(cid='c1', name='Galla', cap_day=300)

    def test_merge(self):
        W2 = types.SimpleNamespace(cid='c2')
        it = lambda w, t0, t1: (w, t0, t0, t1, [f'{w.cid}{t0}'] * 10, True)
        hold = [it(self.W, 100, 110), it(self.W, 140, 150), it(self.W, 200, 205), it(self.W, 400, 410), it(W2, 120, 130)]
        ready, rest = ntcam.merge_items(hold, 230)
        self.assertEqual([r[0].cid for r in ready], ['c2'], 'c1 ki aakhri harkat (205) ke 60 s poore nahi — len-den abhi chal raha ho sakta hai; c2 tayyar')
        ready, rest = ntcam.merge_items(rest, 266)
        self.assertEqual([(r[0].cid, r[2], r[3]) for r in ready], [('c1', 100, 205)], '100..205 = aik (gap 30, 50)')
        self.assertEqual(len(ready[0][4]), 10, '30 tasveeron mein se 10'); self.assertIn('c1100', ready[0][4]); self.assertIn('c1200', ready[0][4])
        self.assertTrue(ready[0][5], 'ginti pehle ho chuki'); self.assertEqual([r[2] for r in rest], [400])
        long = [it(self.W, 1000 + k * 30, 1000 + k * 30 + 20) for k in range(8)]      # 1000..1230 lagatar
        ready, rest = ntcam.merge_items(long, 1300)
        self.assertEqual([(r[2], r[3]) for r in ready], [(1000, 1170), (1180, 1230)], '3 minute se lamba = do len-den')

    def _g(self):
        writes = []
        class F:
            def get(s, path): return None
            def patch(s, path, data): writes.append((path, data)); return True
            def query(s, *a, **k): return []
        pos = types.SimpleNamespace(near=lambda a, b: [], ok_sql=lambda: True, ok_bk=lambda: True, vch_ok=lambda: True)
        g = ntcam.Galla(F(), pos); clips = []
        g.clips = types.SimpleNamespace(shak=lambda *a: clips.append(a[1]))
        return g, writes, clips

    def _run(self, confirm):
        import numpy as np
        g, writes, clips = self._g()
        fr = [(np.random.rand(120, 160, 3) * 255).astype('uint8') for _ in range(4)]
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_judge2', lambda *a: ('nikla', 'shak', 'note shalwar ke paas', 500, True)), \
             mock.patch.object(ntcam, 'ai_confirm', confirm):
            g.handle(self.W, 1000.0, 995.0, 1010.0, fr, True)
        ev = [d for p, d in writes if '/cameraEvents/' in p][0]
        return g, ev, clips

    def test_doosri_raaye_normal(self):
        g, ev, clips = self._run(lambda *a: ('normal', 'note gode par gine, galle mein wapas', 900, 'claude-sonnet-5-5'))
        self.assertEqual(ev['verdict'], 'normal'); self.assertIn('Doosre AI ne dekha: note gode par gine', ev['why']); self.assertIn('pehle: note shalwar', ev['why'])
        self.assertEqual(ev['model'], 'claude-haiku-4-5-20251001+claude-sonnet-5-5'); self.assertEqual(ev['ms'], 1400); self.assertEqual(clips, [], 'shak nahi to video nahi')
        st = g.stats[('c1', ntcam.pk_date(1000.0))]; self.assertEqual((st['shak'], st['checks'], st['touches']), (0, 1, 0), 'ginti pehle ho chuki (counted)')

    def test_doosri_raaye_shak(self):
        g, ev, clips = self._run(lambda *a: ('shak', 'tasveer 7-8: note jeb ke andar', 900, 'claude-sonnet-5-5'))
        self.assertEqual((ev['verdict'], ev['why']), ('shak', 'tasveer 7-8: note jeb ke andar')); self.assertEqual(len(clips), 1, 'shak = video')
        self.assertEqual(g.stats[('c1', ntcam.pk_date(1000.0))]['shak'], 1)

    def test_doosri_raaye_na_chale(self):
        def boom(*a): raise RuntimeError('credit khatam')
        g, ev, clips = self._run(boom)
        self.assertEqual(ev['verdict'], 'shak', 'doosra AI na chale to shak chhupaya nahi jata'); self.assertEqual(len(clips), 1)

    def test_confirm_model_fallback_aur_prompt(self):
        calls = []
        class R:
            def __init__(s, code, body): s.status_code, s._b, s.text = code, body, json.dumps(body)
            def json(s): return s._b
        def post(url, **kw):
            calls.append(kw['json']['model'])
            if kw['json']['model'] == 'claude-sonnet-5-5':
                return R(404, {'type': 'error', 'error': {'type': 'not_found_error', 'message': 'model: claude-sonnet-5-5'}})
            return R(200, {'content': [{'type': 'text', 'text': '{"verdict":"normal","why":"gode par ginti"}'}]})
        with mock.patch.dict(sys.modules, {'requests': types.SimpleNamespace(post=post)}):
            v, why, ms, model = ntcam.ai_confirm('sk-ant-x', ['AA', 'BB'], 'record', 1.5, 'shalwar ke paas')
        self.assertEqual((v, why, model), ('normal', 'gode par ginti', 'claude-sonnet-4-6')); self.assertEqual(calls, ['claude-sonnet-5-5', 'claude-sonnet-4-6'])
        for w in ('GODE', 'ANDAR', 'kam az kam do tasveeron'): self.assertIn(w, ntcam.CONFIRM_PROMPT)
        self.assertIn('GODE (lap)', ntcam.GALLA_PROMPT3); self.assertIn('"paas le jana" shak nahi', ntcam.GALLA_PROMPT3)


class Kahani(unittest.TestCase):
    """v1.8 — len-den ki kahani: tape, chuni tasveerein, AI kahani ka parse, POS se lal nishan, nopay."""
    CRV = {'kind': 'crv', 'no': 'CRV-1', 'vid': 1, 'bill': '00119126', 'at': 1054.0, 'amount': 1860.0, 'party': 'Cash', 'who': 'waqar', 'billAt': 1000.0, 'change': 140.0}

    def st(self, *lines, log=1, verdict='normal', flow='len_den'):
        return {'story': [dict(i=i + 1, kaun=k, kya=a, kis=b, note=n) for i, (k, a, b, n) in enumerate(lines)], 'log': log, 'flow': flow, 'khula': True, 'verdict': verdict, 'why': 'x'}

    def test_tape_box_aur_key_frames(self):
        self.assertEqual(ntcam.tape_box({'x': .4, 'y': .4, 'w': .2, 'h': .2}, {}, 100, 100), ntcam.zone_px({'x': .4, 'y': .4, 'w': .2, 'h': .2}, 100, 100, .8))
        self.assertEqual(ntcam.tape_box({'x': .1, 'y': .1, 'w': .2, 'h': .2}, {'x': .6, 'y': .5, 'w': .2, 'h': .2}, 100, 100), (0, 0, 83, 73), 'dono ko gherne wala dabba')
        w = ntcam.Watch.__new__(ntcam.Watch); import collections
        w.tape = collections.deque([(1000 + k * 0.5, f'j{k}', 5.0 if k in (40, 41, 80) else 0.0) for k in range(200)], maxlen=720)
        kf = w.key_frames(1000, 1099.5, 20, [1070.2])
        ts = [t for t, _ in kf]
        self.assertEqual(len(kf), 20); self.assertEqual(ts, sorted(ts)); self.assertIn(1070.0, ts, 'voucher ke waqt ki tasveer zaroor')
        self.assertIn(1020.0, ts, 'counter mein harkat'); self.assertIn(1040.0, ts)
        self.assertTrue(all(b - a >= 0.5 for a, b in zip(ts, ts[1:])))
        self.assertEqual(len(w.key_frames(1000, 1004, 20)), 9, 'kam hon to sab')
        self.assertTrue(w.tape_covers(1001, 1090)); self.assertFalse(w.tape_covers(990, 1090))

    def test_parse_story(self):
        r = ntcam.parse_story('bla {"story":[{"i":2,"kaun":"daayen customer, neela kurta","kya":"parchi_paisa"},{"i":9,"kya":"baqaya","kis":"wahi","note":"chhota"},'
                              '{"i":30,"kya":"diya"},{"i":4,"kya":"udta"}],"log":"1","flow":"len_den","khula":true,"verdict":"normal","why":"theek"}', 20)
        self.assertEqual([(e['i'], e['kya']) for e in r['story']], [(2, 'parchi_paisa'), (9, 'baqaya')], 'ghalat number / anjaan kya chhor diye')
        self.assertEqual((r['log'], r['flow'], r['khula'], r['verdict']), (1, 'len_den', True, 'normal'))
        self.assertEqual(ntcam.parse_story('kuch nahi', 5)['story'], [])

    def test_judge(self):
        J = lambda res, recs, **k: ntcam.judge_story(res, 1040.0, 1080.0, recs, True, k.get('tender', True))[0]
        ok = self.st(('daayen', 'parchi_paisa', '', ''), ('galle wala', 'rakha', '', ''), ('daayen', 'baqaya', 'wahi', 'chhota'))
        self.assertEqual(J(ok, [self.CRV]), [], 'normal: parchi + paisa, baqaya usi ko, baqaya banta tha')
        self.assertEqual(J(self.st(('daayen', 'parchi_paisa', '', ''), ('baayen', 'khara', '', ''), ('baayen', 'diya', 'aur', '')), [self.CRV]), ['aurko'], 'voucher ke waqt kisi aur ko')
        pay = {'kind': 'pay', 'no': 'p1', 'at': 1060.0, 'amount': 500.0, 'party': 'Supplier'}
        self.assertEqual(J(self.st(('daayen', 'parchi_paisa', '', ''), ('baayen', 'diya', 'aur', '')), [self.CRV, pay]), [], 'Galla screen "de diye" ho to jaiz')
        self.assertEqual(J(ok, [dict(self.CRV, change=0.0)]), ['nochange'], 'di hui raqam = bill, phir bhi baqaya')
        self.assertEqual(J(ok, [dict(self.CRV, change=0.0)], tender=False), [], 'POS raqam nahi likhta to ye jaanch nahi')
        two = self.st(('daayen', 'parchi_paisa', '', ''), ('daayen', 'baqaya', 'wahi', ''), ('daayen', 'baqaya', 'wahi', ''))
        self.assertEqual(J(two, [self.CRV]), ['double'])
        big = self.st(('daayen', 'parchi_paisa', '', ''), ('daayen', 'baqaya', 'wahi', 'bada'))
        self.assertEqual(J(big, [self.CRV]), ['badanote']); self.assertEqual(J(big, [dict(self.CRV, change=3140.0)]), [], 'baqaya 3140 = bada note theek')
        rush = self.st(('daayen', 'parchi_paisa', '', ''), ('beech', 'paisa', '', ''), ('baayen', 'parchi_paisa', '', ''), log=3)
        f, why = ntcam.judge_story(rush, 1040.0, 1080.0, [self.CRV, dict(self.CRV, no='CRV-2', vid=2, bill='00119127', at=1062.0)], True, True)
        self.assertEqual(f, ['noparchi']); self.assertIn('3 logon ne paisa diya, 2 parchi scan — 1 bina parchi', why[0])
        self.assertEqual(J(self.st(('daayen', 'parchi', '', '')), [self.CRV]), ['parchi'], 'parchi di, paisa nahi')
        self.assertEqual(J(self.st(('galle wala', 'jeb', '', '')), [self.CRV]), ['jeb'])
        self.assertEqual(J(self.st(('daayen', 'paisa', '', '')), []), [], 'koi voucher hi nahi -> purana wait / missing (bina parchi) raasta')
        ctx = ntcam.context_text([self.CRV]); self.assertIn('POS: baqaya Rs 140 banta hai', ctx)
        self.assertIn('baqaya 0', ntcam.context_text([dict(self.CRV, change=0.0)]))
        self.assertEqual(ntcam.change_of({'cash': 2000, 'amount': 1860}), 140.0); self.assertEqual(ntcam.change_of({'cash': 1860, 'amount': 1860}), 0.0); self.assertIsNone(ntcam.change_of(None))

    def _g(self, recs):
        writes = []
        class F:
            def get(s, path): return None
            def patch(s, path, data): writes.append((path, data)); return True
            def query(s, *a, **k): return []
        pos = types.SimpleNamespace(near=lambda a, b: [r for r in recs if a <= r['at'] <= b], ok_sql=lambda: True, ok_bk=lambda: True, vch_ok=lambda: True, tender_seen=True)
        g = ntcam.Galla(F(), pos); clips = []
        g.clips = types.SimpleNamespace(shak=lambda *a: clips.append(a[1]))
        return g, writes, clips

    def _w(self):
        import collections
        import threading
        w = ntcam.Watch.__new__(ntcam.Watch); threading.Thread.__init__(w, daemon=True); w.cid, w.name, w.cap_day = 'c1', 'Galla', 300
        w.budget, w.second, w.min_change = 200.0, True, 0
        w.tape = collections.deque([(900 + k * 0.5, f'J{k}', 0.0) for k in range(600)], maxlen=720)
        return w

    def test_handle_story(self):
        """v1.9: sasta sawal -> 🔴 candidate (kisi aur ko) -> doosri raaye (bara AI kahani) -> pakka shak + clip + story."""
        g, writes, clips = self._g([dict(self.CRV)])
        calls = []
        def cheap(key, frames, ctx, gap):
            calls.append(('cheap', len(frames))); return {'nikla': True, 'kis': 'aur', 'note': 'bada', 'why': 'baayen wale ko note diye'}, 400, ntcam.MODEL
        def story(key, frames, ctx, ex, models):
            calls.append(('story', models))
            return self.st(('daayen, neela', 'parchi_paisa', '', ''), ('baayen, safed', 'khara', '', ''), ('baayen, safed', 'diya', 'aur', 'bada')), 1500, 'claude-sonnet-5-5'
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), mock.patch.object(ntcam, 'ai_cheap', cheap), mock.patch.object(ntcam, 'ai_story', story):
            g.handle(self._w(), 1045.0, 1040.0, 1070.0, [], True)
        self.assertEqual(calls, [('cheap', 8), ('story', ntcam.CONFIRM_MODELS)], 'pehle 8 chhoti tasveerein, 🔴 par bara AI')
        ev = [d for p, d in writes if '/cameraEvents/' in p][0]; fr = [d for p, d in writes if '/cameraFrames/' in p][0]
        self.assertEqual((ev['verdict'], ev['flow'], ev['matchState'], ev['match']['kind']), ('shak', 'nikla', 'ok', 'crv'))
        self.assertIn('aurko', ev['flags']); self.assertIn('badanote', ev['flags'], 'baqaya 140, bada note')
        self.assertIn('Voucher ke waqt paisa kisi aur ko', ev['why']); self.assertEqual(ev['model'], 'claude-haiku-4-5-20251001+claude-sonnet-5-5')
        self.assertEqual(len(ev['story']), 3); self.assertEqual(len(fr['frames']), 20, '🔴 par kahani ki 20 tasveerein'); self.assertIn(1054000, fr['times'])
        self.assertEqual(clips, ['c1-1045000']); self.assertEqual(g.by_bill['00119126'], 'c1-1045000')
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        for k in ("'story', 'flags'", "'frames', 'at', 'cam', 'times'", 'frames.size() <= 24', 'story.size() <= 16', "'alerts', 'cost'"):
            self.assertIn(k, rules)
        self.assertLessEqual(set(ev), {'cam', 'camName', 'at', 'date', 'verdict', 'why', 'thumb', 'n', 'ms', 'model', 'agent', 'flow', 'matchState', 'match', 'start', 'end', 'story', 'flags'})
        st = g.stats[('c1', ntcam.pk_date(1045.0))]; self.assertEqual((st['checks'], st['moneyOut'], st['shak']), (1, 1, 1))

    def test_handle_story_normal_ek_hi_AI(self):
        """✅ baqaya usi customer ko = sirf chhota AI, halka card, koi clip nahi."""
        g, writes, clips = self._g([dict(self.CRV)])
        calls = []
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_cheap', lambda *a: (calls.append(1) or {'nikla': True, 'kis': 'wahi', 'note': 'chhota', 'why': 'baqaya diya'}, 400, ntcam.MODEL)), \
             mock.patch.object(ntcam, 'ai_story', lambda *a: self.fail('bara AI nahi lagna chahiye')):
            g.handle(self._w(), 1045.0, 1040.0, 1070.0, [], True)
        ev = [d for p, d in writes if '/cameraEvents/' in p][0]
        self.assertEqual((ev['verdict'], ev['flags'], ev['matchState'], len(calls)), ('normal', [], 'ok', 1)); self.assertIn('Baqaya usi customer ko', ev['why']); self.assertEqual(clips, [])
        self.assertEqual(len([d for p, d in writes if '/cameraFrames/' in p][0]['frames']), 8)

    def test_cheap_nikla_nahi_koi_card_nahi(self):
        g, writes, clips = self._g([dict(self.CRV)])
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_cheap', lambda *a: ({'nikla': False, 'kis': '', 'note': '', 'why': 'paisa rakha'}, 300, ntcam.MODEL)):
            g.handle(self._w(), 1045.0, 1040.0, 1070.0, [], True)
        self.assertEqual([p for p, d in writes if '/cameraEvents/' in p or '/cameraFrames/' in p], [], 'nikla nahi = na card na tasveerein')
        st = g.stats[('c1', ntcam.pk_date(1045.0))]; self.assertEqual((st['checks'], st['moneyIn'], st['moneyOut']), (1, 1, 0))

    def test_cheap_second_off_aur_bina_voucher(self):
        """doosri raaye off: 🔴 seedha; voucher hi nahi: 'novoucher' + matchState missing."""
        g, writes, clips = self._g([])
        w = self._w(); w.second = False
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_cheap', lambda *a: ({'nikla': True, 'kis': 'aur', 'note': '', 'why': 'kisi ko diya'}, 300, ntcam.MODEL)), \
             mock.patch.object(ntcam, 'ai_story', lambda *a: self.fail('second off')):
            g.handle(w, 1045.0, 1040.0, 1070.0, [], True)
        ev = [d for p, d in writes if '/cameraEvents/' in p][0]
        self.assertEqual((ev['verdict'], ev['flags'], ev['matchState'], ev['story']), ('shak', ['novoucher'], 'missing', [])); self.assertEqual(clips, ['c1-1045000'])

    def test_cheap_doosri_raaye_ne_bachaya(self):
        """chhota AI 'aur' kahe lekin bara AI kahani mein sirf baqaya wahi -> ✅ normal."""
        g, writes, clips = self._g([dict(self.CRV)])
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), \
             mock.patch.object(ntcam, 'ai_cheap', lambda *a: ({'nikla': True, 'kis': 'aur', 'note': '', 'why': 'shayad kisi aur ko'}, 300, ntcam.MODEL)), \
             mock.patch.object(ntcam, 'ai_story', lambda *a: (self.st(('daayen', 'parchi_paisa', '', ''), ('daayen', 'baqaya', 'wahi', 'chhota')), 1200, 'claude-sonnet-5-5')):
            g.handle(self._w(), 1045.0, 1040.0, 1070.0, [], True)
        ev = [d for p, d in writes if '/cameraEvents/' in p][0]
        self.assertEqual((ev['verdict'], ev['flags']), ('normal', [])); self.assertIn('Doosre AI ne dekha', ev['why']); self.assertEqual(clips, [])

    def test_budget_min_change_daily(self):
        w = self._w(); w.budget = 1.0; w.min_change = 500
        g, writes, clips = self._g([dict(self.CRV, change=140.0)])
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), mock.patch.object(ntcam, 'ai_cheap', lambda *a: self.fail('chhota baqaya = AI nahi')):
            g.handle(w, 1045.0, 1040.0, 1070.0, [], True)
        self.assertEqual([p for p, d in writes if '/cameraEvents/' in p], []); self.assertEqual(g.stats[('c1', ntcam.pk_date(1045.0))]['matched'], 1)
        w.min_change = 0; g.last_ai = {}
        g.stats[('c1', ntcam.pk_date(1045.0))]['cost'] = 1.2
        with mock.patch.object(ntcam, 'secrets', lambda: {'claudeKey': 'sk-ant-x', 'cams': {}}), mock.patch.object(ntcam, 'ai_cheap', lambda *a: self.fail('budget poora')):
            g.handle(w, 1145.0, 1140.0, 1170.0, [], True)
        self.assertEqual(g.stats[('c1', ntcam.pk_date(1045.0))]['unchecked'], 1, 'budget poora = bina jaanch ginti')
        self.assertEqual(ntcam.cost_rs('claude-haiku-4-5-20251001', 4000, 100), round((4000 * 1 + 100 * 5) / 1e6 * 280, 3))
        q = []; g.clips = types.SimpleNamespace(q=types.SimpleNamespace(put=q.append), shak=lambda *a: None)
        with mock.patch('random.random', lambda: 0.0):
            for k in range(8):
                g.daily_video(w, 2000.0 + k * 100, 2010.0 + k * 100, '2026-09-30')
        self.assertEqual(len(q), 5, 'roz 5 se zyada nahi'); self.assertEqual((q[0]['kind'], q[0]['title'], q[0]['from'], q[0]['to']), ('daily', 'Aaj ki video 1', 1995000, 2020000))

    def test_parse_judge_cheap(self):
        r = ntcam.parse_cheap('{"nikla": "true", "kis": "AUR", "note": "bada", "why": "x"}'); self.assertEqual((r['nikla'], r['kis'], r['note']), (True, 'aur', 'bada'))
        self.assertEqual(ntcam.parse_cheap('kuch nahi')['nikla'], False); self.assertEqual(ntcam.parse_cheap('{"nikla":true,"kis":"udta"}')['kis'], '?')
        J = lambda kis, crvs, note='', tender=True: ntcam.judge_cheap({'nikla': True, 'kis': kis, 'note': note, 'why': ''}, crvs, tender)[0]
        crv = dict(self.CRV)
        self.assertEqual(J('wahi', [crv]), []); self.assertEqual(J('haath', []), []); self.assertEqual(ntcam.judge_cheap({'nikla': False}, [], True), ([], []))
        self.assertEqual(J('jeb', [crv]), ['jeb']); self.assertEqual(J('wahi', []), ['novoucher']); self.assertEqual(J('aur', [crv]), ['aurko']); self.assertEqual(J('?', [crv]), ['unsure'])
        self.assertEqual(J('wahi', [dict(crv, change=0.0)]), ['nochange']); self.assertEqual(J('wahi', [dict(crv, change=0.0)], tender=False), [])
        self.assertEqual(J('wahi', [crv], note='bada'), ['badanote']); self.assertEqual(J('wahi', [dict(crv, change=3140.0)], note='bada'), [])
        for k in ('nikla', 'kis', 'wahi', 'jeb', 'haath'): self.assertIn(k, ntcam.CHEAP_PROMPT)

    def test_nopay(self):
        crv = dict(self.CRV, at=1100.0)
        g, writes, clips = self._g([crv])
        w = self._w(); g.watch_of['c1'] = w
        g.moves.append(('c1', 950.0, 960.0))                     # harkat pehle thi, voucher ki window (1040..1190) mein nahi
        g.nopay_check(now=1260.0)
        ev = [d for p, d in writes if '/cameraEvents/' in p]
        self.assertEqual(len(ev), 1); self.assertEqual((ev[0]['verdict'], ev[0]['flags'], ev[0]['match']['bill']), ('shak', ['nopay'], '00119126'))
        self.assertIn('Parchi scan · paisa nazar nahi aaya: Bill #00119126', ev[0]['why']); self.assertEqual(clips, ['c1-np-1100000'])
        g.nopay_at = 0; g.nopay_check(now=1300.0); self.assertEqual(len([1 for p, d in writes if '/cameraEvents/' in p]), 1, 'aik voucher aik dafa')
        g2, w2, c2 = self._g([dict(crv)]); g2.watch_of['c1'] = self._w(); g2.moves.append(('c1', 1090.0, 1110.0))
        g2.nopay_check(now=1260.0); self.assertEqual([p for p, d in w2 if '/cameraEvents/' in p], [], 'harkat hui = theek')
        g3, w3, c3 = self._g([dict(crv, at=1300.0)]); g3.watch_of['c1'] = self._w()     # tape 900..1199.5 — voucher window poori nahi
        g3.nopay_check(now=1460.0); self.assertEqual([p for p, d in w3 if '/cameraEvents/' in p], [], 'camera us waqt nahi dekh raha tha')

    def test_pos_tender_status(self):
        p = ntcam.Pos(None)
        self.assertIn('Baqaya: dekh raha', p.status())
        p.add({'kind': 'sale', 'no': '1', 'at': 1.0, 'amount': 5.0, 'party': ''}); self.assertIn('Baqaya: POS di hui raqam nahi likhta', p.status())
        p.tender_seen = True; self.assertIn('Baqaya: POS se ✅', p.status())


class Voucher(unittest.TestCase):
    """v1.6 — POS mein Cash Received voucher kahan hai: khud dhoondna (find_link), System Notes ka waqt, bill se jodna."""
    SALES = [{'SaleID': 5001 + i, 'SaleNo': f'{119020 + i:08d}'} for i in range(10)]

    def _sets(self):
        ids = {r['SaleID'] for r in self.SALES}; nos = {ntcam.norm_no(r['SaleNo']) for r in self.SALES}; raw = {r['SaleNo'] for r in self.SALES}
        return ids, nos, raw

    def test_norm_aur_notes(self):
        self.assertEqual(ntcam.norm_no('00119023'), '119023'); self.assertEqual(ntcam.norm_no('CRV-00119023'), '119023'); self.assertEqual(ntcam.norm_no(119023), '119023')
        t = ntcam.notes_times('Created & Printed By:waqar On:9/29/2026 12:32:54 PM at PC:DESKTOP-KEIME1D\nCash Received By:waqar On:9/29/2026 12:33:48 PM at PC:DESKTOP-032A3V6\nCash Received By:waqar On:9/29/2026 12:33:54 PM at PC:DESKTOP-032A3V6')
        import datetime
        utc = datetime.datetime(2026, 9, 29, 7, 33, 48, tzinfo=datetime.timezone.utc).timestamp()
        self.assertEqual([(w, a) for w, a in t], [('waqar', utc), ('waqar', utc + 6)], '12:33:48 pm PK = 07:33:48 UTC; "Created" nahi gina')

    def test_find_link_voucherno_barabar(self):
        ids, nos, raw = self._sets()
        rows = [{'VoucherID': 900 + i, 'VoucherNo': f'CRV-{119020 + i:08d}', 'CreatedOn': None, 'Amount': 100 + i} for i in range(6)]
        self.assertEqual(ntcam.find_link(rows, ids, nos, raw, skip={'VoucherID', 'CreatedOn'})[:2], ('VoucherNo', 'no'), 'voucher "usi number ka"')

    def test_find_link_saleid_sirf_naam_ke_sath(self):
        ids, nos, raw = self._sets()
        rows = [{'VoucherID': 5001 + i, 'RefSaleID': 5001 + i, 'Amount': 5} for i in range(6)]   # VoucherID bhi SaleID jaisa (ittefaq)
        self.assertEqual(ntcam.find_link(rows, ids, nos, raw)[:2], ('RefSaleID', 'id'), 'naam mein sale/ref -> id; VoucherID skip')
        rows2 = [{'VoucherID': 5001 + i, 'Amount': 5} for i in range(6)]
        self.assertIsNone(ntcam.find_link(rows2, ids, nos, raw), 'bina naam ke barabar ID = ittefaq, nahi mana')

    def test_find_link_matn(self):
        ids, nos, raw = self._sets()
        rows = [{'VoucherID': i, 'Description': f'Cash received against Sale # {119020 + i:08d} from counter'} for i in range(6)]
        self.assertEqual(ntcam.find_link(rows, ids, nos, raw)[:2], ('Description', 'text'))
        self.assertIsNone(ntcam.find_link([{'VoucherID': 1, 'Description': 'kharcha'}] * 5, ids, nos, raw), 'kuch na mile to None')

    def test_pos_sale_of_aur_rec(self):
        p = ntcam.Pos(None)
        for r in self.SALES:
            rec = {'kind': 'sale', 'no': r['SaleNo'], 'at': 1000.0, 'start': 990.0, 'sid': r['SaleID'], 'amount': 700.0, 'party': 'Cash'}
            p.sale_by_id[r['SaleID']] = rec; p.sale_by_no[ntcam.norm_no(r['SaleNo'])] = rec
        i = {'mode': 'voucher', 'link': 'VoucherNo', 'link_mode': 'no', 'amount': 'Amount', 'type': 'VType', 'no': 'VoucherNo', 'by': None, 'txt': 'Description'}
        row = {'VoucherID': 77, 'VoucherNo': 'CRV-00119023', 'Amount': 700, 'VType': 'CRV', 'Description': 'x'}
        sale = p.sale_of(i, row); self.assertEqual(sale['sid'], 5004)
        rec = p.vch_rec(i, row, sale, 1054.0, 'CRV-00119023')
        self.assertEqual((rec['kind'], rec['bill'], rec['amount'], rec['billAt']), ('crv', '00119023', 700.0, 1000.0))
        other = p.vch_rec(i, {'VoucherID': 78, 'VoucherNo': 'CPV-5', 'Amount': 300, 'VType': 'CPV', 'Description': 'bijli ka bill'}, None, 1100.0, 'CPV-5')
        self.assertEqual((other['kind'], other['party']), ('voucher', 'bijli ka bill'), 'kharch ka voucher — galla khulna jaiz')
        i2 = dict(i, link='RefSaleID', link_mode='id'); self.assertEqual(p.sale_of(i2, {'RefSaleID': 5009})['no'], '00119028')
        i3 = dict(i, link='Description', link_mode='text'); self.assertEqual(p.sale_of(i3, {'Description': 'against 00119021 ok'})['sid'], 5002)
        self.assertFalse(p.vch_ok()); p.vch = {'mode': 'sale'}; self.assertFalse(p.vch_ok()); self.assertIn('nahi mila', p.vch_text())
        p.vch = i; self.assertTrue(p.vch_ok()); p.add(rec); self.assertIn('Voucher: mil rahe (Voucher.VoucherNo', p.vch_text())

    def test_poll_notes_mode(self):
        """Sale ke System Notes wale khane se (koi voucher table na ho)."""
        import datetime
        p = ntcam.Pos(None); p.vch = {'mode': 'notes', 'link': 'SystemNotes', 'at': ntcam.now_ms()}
        p.sale_by_id[5001] = {'kind': 'sale', 'no': '00119023', 'at': 1000.0, 'start': 990.0, 'sid': 5001, 'amount': 781.0, 'party': 'Cash'}
        class Cur:
            def execute(s, q, *a): s.q = q
            def fetchall(s): return [{'SaleID': 5001, 'SaleNo': '00119023', 'TotalSale': 781, 't': 'Created & Printed By:waqar On:9/29/2026 12:32:54 PM\nCash Received By:waqar On:9/29/2026 12:33:48 PM at PC:X'}]
        p.poll_vouchers(Cur())
        r = [x for x in p.recs if x['kind'] == 'crv']; self.assertEqual(len(r), 1); self.assertEqual((r[0]['bill'], r[0]['who'], r[0]['amount']), ('00119023', 'waqar', 781.0))
        self.assertEqual(ntcam.clock(r[0]['at']), '12:33:48 pm')

    def test_discover_fake_sql(self):
        """Poora dhoond + poll naqli SQL par: Voucher.VoucherNo == SaleNo -> mode voucher; phir naya voucher -> crv rec; file mein yaad."""
        import datetime, tempfile
        pk = lambda h, m, sec: datetime.datetime(2026, 9, 29, h, m, sec)
        sales = [{'SaleID': 5001, 'SaleNo': '00119023'}, {'SaleID': 5002, 'SaleNo': '00119024'}, {'SaleID': 5003, 'SaleNo': '00119025'}]
        vch = [{'VoucherID': 900, 'VoucherNo': 'CRV-00119023', 'CreatedOn': pk(12, 33, 48), 'Amount': 781, 'VoucherTypeID': 1, 'CreatedBy': 8},
               {'VoucherID': 901, 'VoucherNo': 'CRV-00119024', 'CreatedOn': pk(12, 40, 0), 'Amount': 2060, 'VoucherTypeID': 1, 'CreatedBy': 8},
               {'VoucherID': 902, 'VoucherNo': 'CRV-00119025', 'CreatedOn': pk(12, 45, 0), 'Amount': 100, 'VoucherTypeID': 1, 'CreatedBy': 8},
               {'VoucherID': 903, 'VoucherNo': 'CPV-000012', 'CreatedOn': pk(12, 50, 0), 'Amount': 300, 'VoucherTypeID': 2, 'CreatedBy': 8}]
        class Cur:
            def execute(s, q, a=None):
                s.q, s.a = q, a
            def fetchall(s):
                q = s.q
                if 'INFORMATION_SCHEMA.COLUMNS' in q:
                    t = s.a[0]
                    if t == 'Voucher': return [{'COLUMN_NAME': c, 'DATA_TYPE': 'datetime' if c == 'CreatedOn' else ('nvarchar' if c == 'VoucherNo' else 'int')} for c in vch[0]]
                    return [{'COLUMN_NAME': c, 'DATA_TYPE': 'int' if c == 'SaleID' else 'nvarchar'} for c in ('SaleID', 'SaleNo', 'Description')]
                if q.startswith('SELECT SaleID, SaleNo FROM dbo.Sale'): return sales
                if 'FROM dbo.Voucher WHERE [CreatedOn] >= DATEADD(HOUR, -72' in q: return list(reversed(vch))
                if 'FROM dbo.Voucher WHERE VoucherID >' in q: return [v for v in vch if v['VoucherID'] > s.a[0]]
                raise AssertionError('anjaan query: ' + q)
            def fetchone(s):
                if 'MIN(VoucherID)' in s.q: return {'a': 899}
                raise AssertionError(s.q)
        p = ntcam.Pos(None)
        for r in sales:
            rec = {'kind': 'sale', 'no': r['SaleNo'], 'at': 1000.0, 'start': 990.0, 'sid': r['SaleID'], 'amount': 50.0, 'party': 'Cash'}
            p.sale_by_id[r['SaleID']] = rec; p.sale_by_no[ntcam.norm_no(r['SaleNo'])] = rec
        with tempfile.TemporaryDirectory() as d, mock.patch.object(ntcam, 'VCH_FILE', os.path.join(d, 'pos-voucher.json')):
            p.poll_vouchers(Cur())
            self.assertEqual((p.vch['mode'], p.vch['table'], p.vch['link'], p.vch['link_mode'], p.vch['hits']), ('voucher', 'Voucher', 'VoucherNo', 'no', 3))
            self.assertEqual((p.vch['time'], p.vch['amount'], p.vch['type'], p.vch['no'], p.vch['by']), ('CreatedOn', 'Amount', 'VoucherTypeID', 'VoucherNo', 'CreatedBy'))
            crv = [r for r in p.recs if r['kind'] == 'crv']; oth = [r for r in p.recs if r['kind'] == 'voucher']
            self.assertEqual([r['bill'] for r in crv], ['00119023', '00119024', '00119025']); self.assertEqual(ntcam.clock(crv[0]['at']), '12:33:48 pm')
            self.assertEqual((oth[0]['no'], oth[0]['amount']), ('CPV-000012', 300.0), 'kharch ka voucher = jaiz, lekin bill nahi')
            self.assertEqual(p.last_vch, 903)
            self.assertTrue(os.path.exists(os.path.join(d, 'pos-voucher.json')), 'agli dafa dobara nahi dhoondna')
            self.assertIn('Voucher: mil rahe (Voucher.VoucherNo, aaj', p.vch_text()); self.assertTrue(p.vch_ok())
            vch.append({'VoucherID': 904, 'VoucherNo': 'CRV-00119023', 'CreatedOn': pk(12, 33, 54), 'Amount': 781, 'VoucherTypeID': 1, 'CreatedBy': 8})
            p.poll_vouchers(Cur()); self.assertEqual(len([r for r in p.recs if r['kind'] == 'crv']), 4, 'doosra voucher (6 s baad) alag rec, bill wahi')

    def test_clip_padding(self):
        q = []
        c = ntcam.Clips(None, {}); c.q = types.SimpleNamespace(put=q.append)
        c.shak('c1', 'e1', 100.0, 110.0, '2026-09-29')
        self.assertEqual((q[0]['from'], q[0]['to']), (90000, 130000), '10 s pehle, 20 s baad')
        c.shak('c1', 'e2', 100.0, 200.0, '2026-09-29'); self.assertEqual(q[1]['to'], 130000, '40 s ki had')


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


class Video(unittest.TestCase):
    """v1.4 recording (60 s ke .ts tukre) + clip + tukron mein upload. ffmpeg: NTCAM_FFMPEG ya imageio-ffmpeg."""
    def _rec(self, secs=6.5):
        import numpy as np
        class W: latest = None; latest_at = 0
        w = W(); stop = {'x': False}
        def feed():
            while not stop['x']:
                f = np.zeros((360, 640, 3), np.uint8); f[:, int(time_now() * 100) % 600:, :] = 200
                w.latest, w.latest_at = f, time_now(); import time; time.sleep(0.05)
        import threading, time
        threading.Thread(target=feed, daemon=True).start(); time.sleep(0.3)
        old = ntcam.SEG_SEC; ntcam.SEG_SEC = 2
        r = ntcam.Recorder('camtest' + str(int(time_now())), w); r.start(); time.sleep(secs); r.stop(); time.sleep(3)
        ntcam.SEG_SEC = old; stop['x'] = True
        return r

    def test_record_clip_prune_upload(self):
        if not os.environ.get('NTCAM_FFMPEG'):
            self.skipTest('NTCAM_FFMPEG nahi (asal ffmpeg chahiye)')
        r = self._rec()
        segs = ntcam.seg_files(r.dir)
        self.assertGreaterEqual(len(segs), 2, '2 s ke tukre bane'); self.assertEqual(r.err, '')
        self.assertTrue(all(os.path.getsize(p) > 1000 for _, p in segs))
        t0 = segs[0][0] + 0.5; out = os.path.join(ntcam.HOME, 'c.mp4')
        self.assertEqual(r.clip(t0, t0 + 3, out), out, 'clip bani'); self.assertGreater(os.path.getsize(out), 2000)
        self.assertEqual(len(ntcam.pick_segs(segs, t0, t0 + 3, 2)), 2)
        writes = []
        class F:
            def patch(s, path, data): writes.append((path, data)); return True
        ntcam.PART_CHARS = 3000
        n = ntcam.upload_clip(F(), 'clipX', out, {'cam': 'c', 'kind': 'shak', 'eventId': 'e', 'from': 1, 'to': 2, 'date': '2026-09-29'})
        parts = [d for p, d in writes if '/cameraClipParts/' in p]; head = [d for p, d in writes if '/cameraClips/clipX' in p][0]
        self.assertEqual(n, len(parts)); self.assertEqual(head['status'], 'ok'); self.assertEqual(head['n'], n); self.assertFalse(os.path.exists(out), 'upload ke baad file mit gayi')
        self.assertEqual(sorted(p['i'] for p in parts), list(range(n)))
        rules = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firestore.rules'), encoding='utf-8').read()
        blk = rules[rules.index('cameraClips/{clipId}'):]; blk = blk[:blk.index('\n    }')]
        for k in head: self.assertIn("'" + k + "'", blk, 'rules mein nahi: ' + k)
        # prune: sab purana kar do
        for st, p in segs: os.utime(p, None)
        gone = ntcam.prune(r.dir, hours=0)
        self.assertEqual(len(gone), len(segs), '48 ghante se purane mit gaye')

    def test_clip_cmd_and_free(self):
        segs = [(1000, '/x/1000.ts'), (1060, '/x/1060.ts'), (1120, '/x/1120.ts')]
        self.assertEqual([s for s, _ in ntcam.pick_segs(segs, 1070, 1100)], [1060])
        self.assertEqual([s for s, _ in ntcam.pick_segs(segs, 1050, 1130)], [1000, 1060, 1120])
        out = os.path.join(ntcam.HOME, 'z.mp4'); cmd = ntcam.clip_cmd('ffmpeg', segs[1:], 1070, 1100, out)
        self.assertIn('10.00', cmd[cmd.index('-ss') + 1]); self.assertEqual(cmd[cmd.index('-t') + 1], '30.00'); self.assertTrue(os.path.exists(out + '.txt'))
        self.assertGreater(ntcam.free_gb(ntcam.HOME), 0)


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
