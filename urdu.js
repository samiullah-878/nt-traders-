// urdu.js — v237: Roman matn ke neeche Urdu (اردو) ki line — poori app mein (malik, manager, mulazim).
// Tareeqa: lughat UR (pakka matn -> Urdu) + PATTERNS (ginti / naam / waqt wale jumle). Screen par jo naya matn aaye
// (MutationObserver) us ke neeche <ur-s> ki line khud lag jati hai. Jis matn ka tarjuma yahan nahi wo waise hi rehta hai —
// naya lafz jodna ho to bas UR mein aik line. App ka baqi code is file ko nahi jaanta (templates nahi badle).

export const UR = {
  // ---- upar ki patti / tabs ----
  'Noor Traders': 'نور ٹریڈرز', 'Hazri register': 'حاضری رجسٹر', 'Hazri': 'حاضری', 'Salary': 'تنخواہ', 'Staff': 'عملہ', 'Nigrani': 'نگرانی',
  'Settings': 'ترتیبات', 'Request': 'درخواست', 'Talash: naam, "late is hafte"…': 'تلاش: نام، "اس ہفتے دیر"…',
  'Meri hazri': 'میری حاضری', 'Manager panel': 'منیجر پینل', 'Manager': 'منیجر', 'Talash': 'تلاش',
  // ---- login ----
  'Hazri aur salary ka register': 'حاضری اور تنخواہ کا رجسٹر', 'Malik': 'مالک', 'Apna mobile number': 'اپنا موبائل نمبر', 'Login': 'لاگ اِن',
  'Wohi number likhein jo malik ne Staff list mein likha hai. Password ki zaroorat nahi.': 'وہی نمبر لکھیں جو مالک نے عملے کی فہرست میں لکھا ہے۔ پاس ورڈ کی ضرورت نہیں۔',
  'Update check karein': 'اپڈیٹ چیک کریں', 'Logout': 'لاگ آؤٹ', 'Password': 'پاس ورڈ', 'Username': 'یوزر نیم', 'Email': 'ای میل',
  'Email se login (ikhtiyari)': 'ای میل سے لاگ اِن (اختیاری)',
  // ---- aam buttons / lafz ----
  'Save': 'محفوظ کریں', 'Save karein': 'محفوظ کریں', 'Save ho gaya': 'محفوظ ہو گیا', 'Cancel': 'منسوخ', 'Delete': 'حذف کریں', 'Hatayein': 'ہٹائیں',
  'Mitayein': 'مٹائیں', 'Badlein': 'بدلیں', 'Jodein': 'جوڑیں', 'Kholein': 'کھولیں', 'Download': 'ڈاؤن لوڈ', 'Copy': 'کاپی', 'Dikhayein': 'دکھائیں',
  'Haan': 'ہاں', 'Nahi': 'نہیں', 'nahi': 'نہیں', 'Theek hai': 'ٹھیک ہے', 'Theek': 'ٹھیک', 'Rehne dein': 'رہنے دیں', 'Chhoren': 'چھوڑیں',
  'Band karein': 'بند کریں', 'Dobara kholein': 'دوبارہ کھولیں', 'Dobara bhejein': 'دوبارہ بھیجیں', 'Likh dein': 'لکھ دیں', 'Likh diya': 'لکھ دیا',
  'Aaj': 'آج', 'Abhi': 'ابھی', 'abhi': 'ابھی', 'Baqi': 'باقی', 'baqi': 'باقی', 'Khali': 'خالی', 'Abhi khali': 'ابھی خالی', 'Note': 'نوٹ', 'Note (ikhtiyari)': 'نوٹ (اختیاری)',
  '(ikhtiyari)': '(اختیاری)', 'Naam (ikhtiyari)': 'نام (اختیاری)', 'Kuch aur (ikhtiyari)': 'کچھ اور (اختیاری)', 'Wajah': 'وجہ', 'Tareekh': 'تاریخ',
  'Shuru': 'شروع', 'Khatam': 'ختم', 'Kab se': 'کب سے', 'Kab tak': 'کب تک', 'Tafseel': 'تفصیل', 'Apna': 'اپنا', 'Apna waqt': 'اپنا وقت', 'Off': 'آف',
  'Online': 'آن لائن', 'Offline': 'آف لائن', 'Band': 'بند', 'Chalu': 'چالو', 'Final': 'حتمی', 'Andaza': 'اندازہ', 'Andaza (final nahi)': 'اندازہ (حتمی نہیں)',
  'Itw': 'اتوار', 'Mng': 'منگل', 'Jum': 'جمعرات', 'Haf': 'ہفتہ',
  // ---- hazri (malik / manager) ----
  'Din': 'دن', 'Mahina': 'مہینہ', 'Aaj ki hazri PDF': 'آج کی حاضری PDF', 'Register PDF': 'رجسٹر PDF', 'Tawajju chahiye': 'توجہ چاہیے', 'Is hafte': 'اس ہفتے',
  'POS mein bill ban ne ke baad badla gaya — Nigrani > Bill badle': 'POS میں بل بننے کے بعد بدلا گیا — نگرانی > بل بدلے',
  'Nigrani mein photos dekh kar "Theek hai" ya "Shak pakka" karein': 'نگرانی میں تصویریں دیکھ کر "ٹھیک ہے" یا "شک پکا" کریں',
  'Naam': 'نام', 'Aaya': 'آیا', 'Gaya': 'گیا', 'Late': 'دیر', 'Ghair': 'غیر حاضر', 'Ghante': 'گھنٹے', 'Overtime': 'اوور ٹائم',
  'Bina bataye gaya': 'بغیر بتائے گیا', 'Khana break': 'کھانے کا وقفہ', 'Aaj dukaan band (Eid / chutti)': 'آج دکان بند (عید / چھٹی)',
  'Is din dukaan band (Eid / chutti)': 'اس دن دکان بند (عید / چھٹی)', 'Dukaan band': 'دکان بند', 'Dukaan band hatayein': 'دکان بند ہٹائیں',
  'Sab ghair hazir ko hazir lagao': 'سب غیر حاضر کو حاضر لگائیں', 'Selfies dekhein': 'سیلفیاں دیکھیں', 'Selfies': 'سیلفیاں',
  'Sab': 'سب', 'Hazir': 'حاضر', 'Ghair hazir': 'غیر حاضر', 'Chutti/Off': 'چھٹی / آف', 'Chutti': 'چھٹی', 'Aadhi chutti': 'آدھی چھٹی', 'Kaam par': 'کام پر',
  'Salesman': 'سیلزمین', 'Helper': 'ہیلپر', 'Check-Out baqi': 'چیک آؤٹ باقی', 'Gaya:': 'گیا:', 'Aaya:': 'آیا:',
  'Aaya badlein': 'آنے کا وقت بدلیں', 'Waqt badlein': 'وقت بدلیں', 'Malik ne lagayi': 'مالک نے لگائی', 'Hazri lagayein': 'حاضری لگائیں',
  'Hazri hatayein': 'حاضری ہٹائیں', 'Hazri badli': 'حاضری بدلی', 'Hazri hatayi': 'حاضری ہٹائی', 'Hazri durust': 'حاضری درست', '(kyun badla)': '(کیوں بدلا)',
  'Chutti · paisa nahi katega': 'چھٹی · پیسہ نہیں کٹے گا', 'Aadhi chutti (shaam) · paisa katega': 'آدھی چھٹی (شام) · پیسہ کٹے گا',
  'Aadhi chutti (subah) · paisa nahi katega': 'آدھی چھٹی (صبح) · پیسہ نہیں کٹے گا', 'paisa nahi katega': 'پیسہ نہیں کٹے گا', 'paisa katega': 'پیسہ کٹے گا',
  'Paisa': 'پیسہ', 'katega': 'کٹے گا', 'Chutti dein': 'چھٹی دیں', 'Chutti laga dein': 'چھٹی لگا دیں', 'Kitni chutti?': 'کتنی چھٹی؟',
  'Poora din': 'پورا دن', 'Poora din (ya kai din)': 'پورا دن (یا کئی دن)', 'Aadha din — subah': 'آدھا دن — صبح', 'Aadha din — shaam': 'آدھا دن — شام',
  'Aadha din — subah ki chutti (der se aayega)': 'آدھا دن — صبح کی چھٹی (دیر سے آئے گا)', 'Aadha din — shaam ki chutti (jaldi jayega)': 'آدھا دن — شام کی چھٹی (جلدی جائے گا)',
  'Excel file tayyar hai': 'Excel فائل تیار ہے', 'Aaj ke record': 'آج کے ریکارڈ', 'Us waqt duty par:': 'اس وقت ڈیوٹی پر:',
  // ---- talash ----
  'late is hafte': 'اس ہفتے دیر', 'ghair hazir aaj': 'آج غیر حاضر', 'checkout baqi': 'چیک آؤٹ باقی', 'salary baqi': 'تنخواہ باقی', 'advance is mahine': 'اس مہینے ایڈوانس',
  'chutti is mahine': 'اس مہینے چھٹی', 'late pichle mahine': 'پچھلے مہینے دیر', 'Salary baqi': 'تنخواہ باقی',
  // ---- staff tab ----
  'Naya staff': 'نیا عملہ', 'Staff shamil karein': 'عملہ شامل کریں', 'Staff ki maloomat': 'ملازم کی معلومات', 'Koi staff nahi mila.': 'کوئی عملہ نہیں ملا۔',
  'Mobile number': 'موبائل نمبر', 'Kaam': 'کام', 'Kaam shuru kiya': 'کام شروع کیا', 'Pata': 'پتہ', 'Tasveer chunein': 'تصویر چنیں',
  'Duty shuru': 'ڈیوٹی شروع', 'Duty khatam': 'ڈیوٹی ختم', 'Hafta-war chutti': 'ہفتہ وار چھٹی', 'Is staff ki mahana salary (Rs)': 'اس ملازم کی ماہانہ تنخواہ (Rs)',
  'Roz ke ghante': 'روز کے گھنٹے', 'Overtime rate (Rs/ghanta)': 'اوور ٹائم ریٹ (Rs/گھنٹہ)', 'Khane ke paise': 'کھانے کے پیسے', 'Raqam (Rs)': 'رقم (Rs)',
  'Khane ke paise salary mein jorein': 'کھانے کے پیسے تنخواہ میں جوڑیں', 'Points ka rate (agar dete hain)': 'پوائنٹس کا ریٹ (اگر دیتے ہیں)', '1 point = Rs': '1 پوائنٹ = Rs',
  'Ijazat': 'اجازت', 'Khane ki bari': 'کھانے کی باری', 'Pehli bari': 'پہلی باری', 'Doosri bari': 'دوسری باری', 'senior': 'سینئر', 'manager': 'منیجر',
  'Staff apne number se login kar sakta hai': 'ملازم اپنے نمبر سے لاگ اِن کر سکتا ہے', '(yehi staff ka login hai)': '(یہی ملازم کا لاگ اِن ہے)',
  '(badal nahi sakta — hazri isi par hai)': '(بدل نہیں سکتا — حاضری اسی پر ہے)', 'Default salary (Settings mein likhein)': 'ڈیفالٹ تنخواہ (ترتیبات میں لکھیں)',
  'Login link': 'لاگ اِن لنک', 'WhatsApp par bhejein': 'واٹس ایپ پر بھیجیں', 'Link copy karein': 'لنک کاپی کریں', 'Staff save ho gaya': 'عملہ محفوظ ہو گیا',
  'Is number ka staff pehle se mojood hai.': 'اس نمبر کا ملازم پہلے سے موجود ہے۔', 'Duty, salary aur baqi settings': 'ڈیوٹی، تنخواہ اور باقی ترتیبات',
  'Neeche "Settings" tab mein': 'نیچے "ترتیبات" ٹیب میں', 'Record nahi': 'ریکارڈ نہیں', 'Abhi tak app nahi kholi': 'ابھی تک ایپ نہیں کھولی',
  // ---- salary ----
  'Salary sheet': 'تنخواہ شیٹ', 'Sab ki slips': 'سب کی سلپس', 'Default salary': 'ڈیفالٹ تنخواہ', 'Kul banti salary': 'کل بنتی تنخواہ', 'Ada ho chuki': 'ادا ہو چکی',
  'Salary settings': 'تنخواہ کی ترتیبات', 'Default salary: abhi likhi nahi': 'ڈیفالٹ تنخواہ: ابھی لکھی نہیں', 'Mahana salary (tay shuda)': 'ماہانہ تنخواہ (طے شدہ)',
  'Mahana salary': 'ماہانہ تنخواہ', 'Salary ki adaigi': 'تنخواہ کی ادائیگی', 'Abhi koi payment nahi.': 'ابھی کوئی ادائیگی نہیں۔', 'Aam ghante': 'عام گھنٹے',
  'Final karein': 'حتمی کریں', 'Payment likhein': 'ادائیگی لکھیں', 'Payment likh di': 'ادائیگی لکھ دی', 'Salary final ho gayi': 'تنخواہ حتمی ہو گئی', 'Salary final': 'تنخواہ حتمی',
  'Sab par default salary lagayein': 'سب پر ڈیفالٹ تنخواہ لگائیں', 'Sab par default salary lag gayi': 'سب پر ڈیفالٹ تنخواہ لگ گئی', 'Sab par default salary': 'سب پر ڈیفالٹ تنخواہ',
  'Sab staff default salary par hain.': 'سب عملہ ڈیفالٹ تنخواہ پر ہے۔', 'Hazri ke mutabiq salary': 'حاضری کے مطابق تنخواہ', 'qarz baqi': 'قرض باقی',
  'Advance / bonus / qarz': 'ایڈوانس / بونس / قرض', 'Advance, bonus aur payments': 'ایڈوانس، بونس اور ادائیگیاں', 'Advance': 'ایڈوانس', 'Advance (kat gaya)': 'ایڈوانس (کٹ گیا)',
  'Qarz': 'قرض', 'Qarz ki qist': 'قرض کی قسط', 'Salary di': 'تنخواہ دی', 'Is mahine koi entry nahi.': 'اس مہینے کوئی اندراج نہیں۔', 'Meri salary': 'میری تنخواہ', 'Mil chuki': 'مل چکی',
  'Mahine ke din': 'مہینے کے دن', 'khali = aam rate': 'خالی = عام ریٹ',
  // ---- settings ----
  'Rozana ka kaam': 'روزانہ کا کام', 'Chutti / correction ki requests': 'چھٹی / درستی کی درخواستیں', 'Koi nayi request nahi': 'کوئی نئی درخواست نہیں',
  'Koi nayi request nahi.': 'کوئی نئی درخواست نہیں۔', 'Requests': 'درخواستیں', 'Bina bataye gaya — tickets': 'بغیر بتائے گیا — ٹکٹ', 'Maaf / warning / katauti': 'معاف / وارننگ / کٹوتی',
  'Bahar jane ki parchiyan': 'باہر جانے کی پرچیاں', 'Aaj ki parchiyan': 'آج کی پرچیاں', 'Sab parchiyan': 'سب پرچیاں', 'Tabdeeli ki history': 'تبدیلیوں کی تاریخ',
  'Kis ki hazri / salary kab aur kyun badli': 'کس کی حاضری / تنخواہ کب اور کیوں بدلی', 'Advance / qarz ka khata': 'ایڈوانس / قرض کا کھاتہ', 'Kis ka kitna qarz baqi': 'کس کا کتنا قرض باقی',
  'Qawaid (sab staff par)': 'قواعد (سب عملے پر)', 'Duty ka waqt': 'ڈیوٹی کا وقت', 'Duty ka waqt (sab par)': 'ڈیوٹی کا وقت (سب پر)', 'Salary ke qawaid': 'تنخواہ کے قواعد',
  'Salary ke qawaid (sab par)': 'تنخواہ کے قواعد (سب پر)', 'Check-In ki had aur hidayat': 'چیک اِن کی حد اور ہدایت', 'App': 'ایپ', 'App ki jaanch': 'ایپ کی جانچ',
  'Phones ki jaanch': 'فونز کی جانچ', 'Notifications (app band ho tab bhi)': 'اطلاعات (ایپ بند ہو تب بھی)', 'Band — chalu karein': 'بند — چالو کریں',
  'App home screen par lagayein': 'ایپ ہوم اسکرین پر لگائیں', 'Icon se seedha khule': 'آئیکن سے سیدھی کھلے', 'Update ke links': 'اپڈیٹ کے لنک',
  'App update check karein': 'ایپ کی اپڈیٹ چیک کریں', 'Hazri na dikhe to is ka screenshot bhejein': 'حاضری نہ دکھے تو اس کا اسکرین شاٹ بھیجیں',
  'Malik ka password badlein': 'مالک کا پاس ورڈ بدلیں', 'Password badlein': 'پاس ورڈ بدلیں', 'App ko halka karein (aik dafa)': 'ایپ کو ہلکا کریں (ایک دفعہ)',
  'Aane ka waqt': 'آنے کا وقت', 'Jane ka waqt': 'جانے کا وقت', 'Duty:': 'ڈیوٹی:', 'is ke baad Late': 'اس کے بعد دیر', 'Late ki riayat (minute)': 'دیر کی رعایت (منٹ)',
  'Sab staff default duty par hain.': 'سب عملہ ڈیفالٹ ڈیوٹی پر ہے۔', 'Default mahana salary (Rs)': 'ڈیفالٹ ماہانہ تنخواہ (Rs)', 'Overtime (Rs/ghanta)': 'اوور ٹائم (Rs/گھنٹہ)',
  'Hisab kaise ho': 'حساب کیسے ہو', 'Manzoor chutti ki salary nahi kategi': 'منظور چھٹی کی تنخواہ نہیں کٹے گی', 'Har kitne late par jurmana': 'ہر کتنی دیر پر جرمانہ',
  '0 = band': '0 = بند', 'Jurmana (din ki salary)': 'جرمانہ (دن کی تنخواہ)', '(har ghanta = aik ghante ki salary)': '(ہر گھنٹہ = ایک گھنٹے کی تنخواہ)',
  'Khane ke break ka waqt bhi salary se katein': 'کھانے کے وقفے کا وقت بھی تنخواہ سے کاٹیں', '(aam tor par nahi katta)': '(عام طور پر نہیں کٹتا)',
  'Check-In dukaan se kitni door tak (meter)': 'چیک اِن دکان سے کتنی دور تک (میٹر)', 'Staff ke liye hidayat': 'عملے کے لیے ہدایت',
  '(un ki screen par nazar aati hai)': '(ان کی اسکرین پر نظر آتی ہے)', 'Version': 'ورژن', 'App ki aaj ki tareekh': 'ایپ کی آج کی تاریخ',
  'Phone ki tareekh (purana tareeqa)': 'فون کی تاریخ (پرانا طریقہ)', 'Internet': 'انٹرنیٹ', 'Server se aakhri hazri': 'سرور سے آخری حاضری', 'Ghaltiyan': 'غلطیاں',
  'Daba kar AM / PM theek karein': 'دبا کر AM / PM ٹھیک کریں', 'Dukaan band hata diya': 'دکان بند ہٹا دیا', 'Dukaan band hataya': 'دکان بند ہٹایا',
  'Is din sab ki chutti (dukaan band)': 'اس دن سب کی چھٹی (دکان بند)', 'Request ka jawab': 'درخواست کا جواب',
  // ---- requests / tickets / parchi / khana ----
  'Manzoor': 'منظور', 'Na-manzoor': 'نامنظور', 'Manzoor — paisa katega': 'منظور — پیسہ کٹے گا', 'Manzoor — paisa nahi katega': 'منظور — پیسہ نہیں کٹے گا',
  'Manzoor ho gayi': 'منظور ہو گئی', 'Mana kar diya': 'منع کر دیا', 'Jawab baqi': 'جواب باقی', 'Jawab ka intezar': 'جواب کا انتظار', 'Faisla baqi': 'فیصلہ باقی',
  'Chutti lag gayi': 'چھٹی لگ گئی', 'Naya ticket': 'نیا ٹکٹ', 'Bina bataye gaya — ticket': 'بغیر بتائے گیا — ٹکٹ', 'Kaun gaya?': 'کون گیا؟', 'Kab gaya': 'کب گیا',
  'Wapas kab aaya': 'واپس کب آیا', 'Ticket banayein': 'ٹکٹ بنائیں', 'Ticket ban gaya — malik faisla karega': 'ٹکٹ بن گیا — مالک فیصلہ کرے گا',
  'Katauti (Rs)': 'کٹوتی (Rs)', 'Maaf': 'معاف', 'Warning': 'وارننگ', 'Katauti': 'کٹوتی', 'Katauti lag gayi': 'کٹوتی لگ گئی',
  'Bahar se Check-Out — malik ke paas': 'باہر سے چیک آؤٹ — مالک کے پاس', 'Bahar se Check-Out': 'باہر سے چیک آؤٹ', 'Wapas aa gaya': 'واپس آ گیا',
  'Wapas aa gaya (malik lagaye)': 'واپس آ گیا (مالک لگائے)', 'Abhi bahar': 'ابھی باہر', 'Wapas ✓': 'واپس ✓', 'Wapsi lag gayi': 'واپسی لگ گئی',
  'Sab ki wapsi lag gayi': 'سب کی واپسی لگ گئی', 'Sab wapas aa gaye': 'سب واپس آ گئے', 'Jo wapas aa jaye us ke naam par dabayein.': 'جو واپس آ جائے اس کے نام پر دبائیں۔',
  'Khane ka waqfa': 'کھانے کا وقفہ', 'Kitni der ka break?': 'کتنی دیر کا وقفہ؟', 'Kaun jayega?': 'کون جائے گا؟', 'Pehli bari · duty par nahi': 'پہلی باری · ڈیوٹی پر نہیں',
  'Gate Pass': 'گیٹ پاس', 'GATE PASS ·': 'گیٹ پاس ·', 'Guard ko dikhayein': 'گارڈ کو دکھائیں', 'Parchi malik ke paas hai': 'پرچی مالک کے پاس ہے',
  'Parchi malik ko chali gayi': 'پرچی مالک کو چلی گئی', 'Chutti ke baad Check-Out bhool gaya': 'چھٹی کے بعد چیک آؤٹ بھول گیا',
  // ---- mulazim ki apni screen ----
  'App ko home screen par lagayein': 'ایپ کو ہوم اسکرین پر لگائیں',
  'Phir icon daba kar seedha aap ka safha khulega — na link, na number.': 'پھر آئیکن دبا کر سیدھا آپ کا صفحہ کھلے گا — نہ لنک، نہ نمبر۔',
  'Kaise lagayein?': 'کیسے لگائیں؟', 'Baad mein': 'بعد میں', 'Check-In karein': 'چیک اِن کریں', 'Check-Out karein': 'چیک آؤٹ کریں',
  'Waqt guzar chuka hai — abhi Check-In karein': 'وقت گزر چکا ہے — ابھی چیک اِن کریں', 'Aap kaam par hain': 'آپ کام پر ہیں',
  'Malik tak pohanch gayi': 'مالک تک پہنچ گئی', 'Daba kar rakhein · location lagegi': 'دبا کر رکھیں · لوکیشن لگے گی', 'Aaj ki hazri mukammal': 'آج کی حاضری مکمل',
  'Check-Out malik tak pohanch gaya': 'چیک آؤٹ مالک تک پہنچ گیا', 'Bahar jana hai? Parchi banayein': 'باہر جانا ہے؟ پرچی بنائیں',
  'WAPAS': 'واپس', 'CHUTTI': 'چھٹی', 'Wapsi malik tak pohanch gayi': 'واپسی مالک تک پہنچ گئی', 'Kal waqt par aayein': 'کل وقت پر آئیں', 'Shukriya, kal milte hain': 'شکریہ، کل ملتے ہیں',
  'par lagega.': 'پر لگے گا۔', 'Dukaan par hoon — location dobara dekhein': 'دکان پر ہوں — لوکیشن دوبارہ دیکھیں', 'Dukaan se kab nikle?': 'دکان سے کب نکلے؟',
  'Kaam se bahar (maal / delivery)': 'کام سے باہر (مال / ڈیلیوری)', 'Malik / manager ne bheja': 'مالک / منیجر نے بھیجا', 'Doosri wajah': 'دوسری وجہ',
  'Malik ko request bhejein': 'مالک کو درخواست بھیجیں', 'Malik ko bhejein': 'مالک کو بھیجیں', 'Check-Out server par NAHI laga': 'چیک آؤٹ سرور پر نہیں لگا',
  'Check-Out lag raha hai…': 'چیک آؤٹ لگ رہا ہے…', 'Chutti chahiye': 'چھٹی چاہیے', 'Hazri ghalat hai': 'حاضری غلط ہے', 'Meri requests': 'میری درخواستیں',
  'Request malik ko chali gayi': 'درخواست مالک کو چلی گئی', 'Hazri save ho gayi': 'حاضری محفوظ ہو گئی', 'Selfie Check-In ke waqt li gayi': 'سیلفی چیک اِن کے وقت لی گئی',
  // ---- nigrani / cameras ----
  'Normal': 'نارمل', 'Shak': 'شک', 'shak': 'شک', 'Shak pakka': 'شک پکا', '🔐 Keys / AI': '🔐 چابیاں / AI', '📋 Len-den': '📋 لین دین', '📷 Cameras': '📷 کیمرے',
  '🩺 Doctor': '🩺 ڈاکٹر', '🔔 Khabar': '🔔 خبریں', 'Liya + baqaya': 'لیا + بقایا', '🧪 Test len-den': '🧪 ٹیسٹ لین دین', 'Paisa nikla': 'پیسہ نکلا', 'Paisa aaya': 'پیسہ آیا',
  '🎬 Waqt ki clip': '🎬 وقت کی کلپ', 'galla chhua': 'گلّہ چھوا', 'AI jaanch': 'AI جانچ', 'shak dekhe': 'شک دیکھے', 'Na dekhe shak': 'نہ دیکھے شک',
  'paisa aaya': 'پیسہ آیا', 'paisa nikla': 'پیسہ نکلا', 'Mangwayi hui clips': 'منگوائی ہوئی کلپس', 'PC video bana raha hai…': 'PC ویڈیو بنا رہا ہے…',
  'Bill badle': 'بل بدلے', 'Bina voucher': 'بغیر واؤچر', 'bina voucher': 'بغیر واؤچر', 'Parchi / baqaya': 'پرچی / بقایا', 'Cash Received voucher': 'کیش وصولی واؤچر',
  'voucher / entry mili': 'واؤچر / اندراج ملا', 'Bina voucher paisa nikla': 'بغیر واؤچر پیسہ نکلا', 'Bina voucher paisa nikla:': 'بغیر واؤچر پیسہ نکلا:',
  '🎬 Video ka intezar': '🎬 ویڈیو کا انتظار', '🎬 Video': '🎬 ویڈیو', '▶ Video dekhein': '▶ ویڈیو دیکھیں', '▶ Counter video': '▶ کاؤنٹر ویڈیو',
  '🎬 Aaj videos:': '🎬 آج کی ویڈیوز:', 'bani': 'بنی', '(card khol kar ▶ dekhein)': '(کارڈ کھول کر ▶ دیکھیں)', 'Counter': 'کاؤنٹر', 'Galla': 'گلّہ', 'Clip': 'کلپ',
  'PC ko farmaish gayi…': 'PC کو فرمائش گئی…', 'Abhi ki tasveer': 'ابھی کی تصویر', 'Tasveer abhi nahi aayi': 'تصویر ابھی نہیں آئی', 'Camera save ho gaya': 'کیمرہ محفوظ ہو گیا',
  'Galla ka hissa': 'گلّے کا حصہ', 'Counter ka hissa': 'کاؤنٹر کا حصہ', 'Sirf dekhna': 'صرف دیکھنا', 'Camera': 'کیمرہ', 'Doctor': 'ڈاکٹر',
  'PC jodein': 'PC جوڑیں', 'Ye aik command type kar ke Enter dabayein:': 'یہ ایک کمانڈ ٹائپ کر کے Enter دبائیں:', 'PC code': 'PC کوڈ', 'PC ka code banayein.': 'PC کا کوڈ بنائیں۔',
  'Code banayein': 'کوڈ بنائیں', 'Camera PC chal raha hai': 'کیمرہ PC چل رہا ہے', 'Camera PC abhi juda nahi': 'کیمرہ PC ابھی جڑا نہیں', 'Camera PC band hai': 'کیمرہ PC بند ہے',
  '📡 Network par cameras / NVR': '📡 نیٹ ورک پر کیمرے / NVR', '🔍 Dobara dhoondein': '🔍 دوبارہ ڈھونڈیں', 'PC dhoond raha hai…': 'PC ڈھونڈ رہا ہے…',
  'PC ne network par ye bhi dekhe:': 'PC نے نیٹ ورک پر یہ بھی دیکھے:', 'Is ka password': 'اس کا پاس ورڈ', 'PC ko keh diya — 15-60 second': 'PC کو کہہ دیا — 15-60 سیکنڈ',
  '🎬 Recording ki khabar abhi nahi aayi': '🎬 ریکارڈنگ کی خبر ابھی نہیں آئی', '🎬 Recording chalu — video ban sakti hai': '🎬 ریکارڈنگ چالو — ویڈیو بن سکتی ہے',
  'Galla ka hissa abhi mark nahi — nigrani band': 'گلّے کا حصہ ابھی نشان زد نہیں — نگرانی بند', 'Abhi mark karein': 'ابھی نشان لگائیں', 'Saaf karein': 'صاف کریں',
  'Bina parchi paisa liya': 'بغیر پرچی پیسہ لیا', '🔴 Bina parchi paisa liya': '🔴 بغیر پرچی پیسہ لیا', 'Bina parchi paisa liya:': 'بغیر پرچی پیسہ لیا:',
  'Bina parchi / saaf nahi': 'بغیر پرچی / صاف نہیں', 'parchi ka rule': 'پرچی کا اصول', 'parchi di': 'پرچی دی', 'bina parchi': 'بغیر پرچی',
  'Parchi di — parchi aur paisa diya': 'پرچی دی — پرچی اور پیسہ دیا', 'Baqaya usi customer ko': 'بقایا اسی گاہک کو', 'Galla ki harkat': 'گلّے کی حرکت',
  '🎬 Mukammal clip mangwayein': '🎬 مکمل کلپ منگوائیں', 'Mukammal clip mangwayein': 'مکمل کلپ منگوائیں', 'Farmaish bhejein': 'فرمائش بھیجیں', 'Us waqt ki photos': 'اس وقت کی تصویریں',
  'Record mila:': 'ریکارڈ ملا:', 'Is din galla par koi harkat record nahi hui.': 'اس دن گلّے پر کوئی حرکت ریکارڈ نہیں ہوئی۔', 'Is filter mein kuch nahi.': 'اس فلٹر میں کچھ نہیں۔',
  'Theek hai likh diya': '"ٹھیک ہے" لکھ دیا', '■ Khatam': '■ ختم', '▶ Shuru': '▶ شروع', '▶ Test shuru': '▶ ٹیسٹ شروع', '🧪 Test chal raha…': '🧪 ٹیسٹ چل رہا…',
  'Test zip tayyar hai': 'ٹیسٹ zip تیار ہے', 'Test mit gaya': 'ٹیسٹ مٹ گیا', 'Chhoren (test nahi)': 'چھوڑیں (ٹیسٹ نہیں)', 'naqli len-den': 'نقلی لین دین', 'dabayein': 'دبائیں',
  'Len-den karwayein (zyada se zyada 3 minute)': 'لین دین کروائیں (زیادہ سے زیادہ 3 منٹ)', 'dabayein aur likhein asal mein kya hua': 'دبائیں اور لکھیں اصل میں کیا ہوا',
  'Waqt khud likhein (pehle ho chuka len-den)': 'وقت خود لکھیں (پہلے ہو چکا لین دین)', 'Kin cameras ki video': 'کن کیمروں کی ویڈیو', 'Asal mein kya hua': 'اصل میں کیا ہوا',
  'Paisa kisi aur ko diya': 'پیسہ کسی اور کو دیا', 'Note jeb mein dala': 'نوٹ جیب میں ڈالا', 'Haath seene / jeb ke paas (normal)': 'ہاتھ سینے / جیب کے پاس (نارمل)',
  'Parchi di, paisa nahi': 'پرچی دی، پیسہ نہیں', '2-3 customer aik saath': '2-3 گاہک ایک ساتھ', 'Sirf ginti / kuch nahi': 'صرف گنتی / کچھ نہیں',
  'Bhejein — video banwayein': 'بھیجیں — ویڈیو بنوائیں', 'Roz AI jaanch ki had (kharcha qaabu)': 'روز AI جانچ کی حد (خرچہ قابو)',
  '🔴 se pehle bara AI doosri raaye de': '🔴 سے پہلے بڑا AI دوسری رائے دے', 'Kaunsa AI': 'کون سا AI', 'Harkat: Kam': 'حرکت: کم', 'Harkat: Aam': 'حرکت: عام', 'Harkat: Zyada': 'حرکت: زیادہ',
  // ---- keys / AI / khabar / doctor ----
  '🔑 AI keys': '🔑 AI چابیاں', '📷 Camera / NVR ka password': '📷 کیمرہ / NVR کا پاس ورڈ', 'Doosra password (misal galla camera)': 'دوسرا پاس ورڈ (مثلاً گلّہ کیمرہ)',
  'Save — PC 1 minute mein khud lega': 'محفوظ — PC ایک منٹ میں خود لے گا', 'Save — PC 1 minute mein khud le lega': 'محفوظ — PC ایک منٹ میں خود لے لے گا',
  '🤖 Kaunsa AI': '🤖 کون سا AI', 'Chhota AI': 'چھوٹا AI', 'Bara AI': 'بڑا AI', '— har len-den (parchi di ya nahi)': '— ہر لین دین (پرچی دی یا نہیں)',
  'Model save karein': 'ماڈل محفوظ کریں', 'Model save — agli jaanch se': 'ماڈل محفوظ — اگلی جانچ سے', 'Ya apna model likhein': 'یا اپنا ماڈل لکھیں', '✅ save': '✅ محفوظ',
  'Key mit gayi': 'چابی مٹ گئی', '🔔 Camera ki khabrein': '🔔 کیمرے کی خبریں', 'Phone notification': 'فون کی اطلاع', 'Kis cheez ki khabar aaye': 'کس چیز کی خبر آئے',
  'Bina parchi / shak': 'بغیر پرچی / شک', 'Parchi saaf nahi (AI pakka nahi)': 'پرچی صاف نہیں (AI کو یقین نہیں)', 'Mangwayi hui clip tayyar': 'منگوائی ہوئی کلپ تیار',
  'Bill cancel / badla (sirf POS wale PC par)': 'بل منسوخ / بدلا (صرف POS والے PC پر)', 'Khabar ki setting save': 'خبر کی ترتیب محفوظ',
  '🩺 NT Doctor': '🩺 NT ڈاکٹر', '➕ Cameras / NVR jodein': '➕ کیمرے / NVR جوڑیں', 'PC Doctor chalao': 'PC ڈاکٹر چلائیں', 'PC dekh raha hai…': 'PC دیکھ رہا ہے…',
  'PC cameras dhoond raha hai — 2-3 minute': 'PC کیمرے ڈھونڈ رہا ہے — 2-3 منٹ'
};

const DAYS = { Peer: 'پیر', Mangal: 'منگل', Budh: 'بدھ', Jumerat: 'جمعرات', Juma: 'جمعہ', Hafta: 'ہفتہ', Itwar: 'اتوار' };
const MONTHS = { Jan: 'جنوری', Feb: 'فروری', Mar: 'مارچ', Apr: 'اپریل', May: 'مئی', Jun: 'جون', Jul: 'جولائی', Aug: 'اگست', Sep: 'ستمبر', Oct: 'اکتوبر', Nov: 'نومبر', Dec: 'دسمبر',
  January: 'جنوری', February: 'فروری', March: 'مارچ', April: 'اپریل', June: 'جون', July: 'جولائی', August: 'اگست', September: 'ستمبر', October: 'اکتوبر', November: 'نومبر', December: 'دسمبر' };

/** Roman naam / waqt Urdu ki line ke andar apni tarteeb mein rahe ("9:15 am – 7:00 pm" ulta na ho). */
const L = s => '⁦' + s + '⁩';
/** Andar ke tukre ka Urdu ho to wo, warna Roman jaisa hai waisa (tarteeb mehfooz). */
const sub = s => urduFor(s) || L(s);
const HM = (h, m) => `${h} گھنٹے ${m} منٹ`;

/** Ginti / naam / waqt wale jumle: [regex, (match) => Urdu]. Naam aur waqt jaise hain waise hi rehte hain. */
export const PATTERNS = [
  // tareekh / din
  [/^(Peer|Mangal|Budh|Jumerat|Juma|Hafta|Itwar), (\d+) ([A-Za-z]+) (\d{4})$/, m => MONTHS[m[3]] && `${DAYS[m[1]]}، ${m[2]} ${MONTHS[m[3]]} ${m[4]}`],
  [/^(Peer|Mangal|Budh|Jumerat|Juma|Hafta|Itwar)$/, m => DAYS[m[1]]],
  [/^([A-Za-z]+) (\d{4})$/, m => MONTHS[m[1]] && `${MONTHS[m[1]]} ${m[2]}`],
  [/^(\d+) ([A-Za-z]{3})$/, m => MONTHS[m[2]] && `${m[1]} ${MONTHS[m[2]]}`],
  [/^\((\d+) ([A-Za-z]{3}) – (\d+) ([A-Za-z]{3})\)$/, m => MONTHS[m[2]] && MONTHS[m[4]] && `(${m[1]} ${MONTHS[m[2]]} – ${m[3]} ${MONTHS[m[4]]})`],
  [/^(.+ \d{4}): Dukaan band$/, m => urduFor(m[1]) && `${urduFor(m[1])}: دکان بند`],
  [/^([A-Za-z]+ \d{4}) ki hazri$/, m => urduFor(m[1]) && `${urduFor(m[1])} کی حاضری`],
  [/^Chutti: (\d+ [A-Za-z]{3})$/, m => `چھٹی: ${sub(m[1])}`],
  [/^Sirf (\d+ [A-Za-z]{3})$/, m => `صرف ${sub(m[1])}`],
  [/^Sab \((\d+) din\)$/, m => `سب (${m[1]} دن)`],
  [/^(\d+) min pehle$/, m => `${m[1]} منٹ پہلے`],
  [/^(\d+) ghante pehle$/, m => `${m[1]} گھنٹے پہلے`],
  [/^(\d+) din pehle$/, m => `${m[1]} دن پہلے`],
  // tawajju / ginti
  [/^(\d+) phone se Check-Out server tak nahi gayi$/, m => `${m[1]} فون سے چیک آؤٹ سرور تک نہیں گیا`],
  [/^Aaj (\d+) bill cancel \/ badle$/, m => `آج ${m[1]} بل منسوخ / تبدیل ہوئے`],
  [/^(\d+) bill cancel \/ badle$/, m => `${m[1]} بل منسوخ / تبدیل`],
  [/^Aaj (\d+) dafa galla par shak · (\d+) dafa bina voucher galla khula$/, m => `آج ${m[1]} دفعہ گلّے پر شک · ${m[2]} دفعہ بغیر واؤچر گلّہ کھلا`],
  [/^(\d+) Check-Out baqi — daba kar band karein$/, m => `${m[1]} چیک آؤٹ باقی — دبا کر بند کریں`],
  [/^(\d+) Check-Out baqi$/, m => `${m[1]} چیک آؤٹ باقی`],
  [/^(\d+) request ka jawab dein$/, m => `${m[1]} درخواست کا جواب دیں`],
  [/^(\d+) ka jawab baqi$/, m => `${m[1]} کا جواب باقی`],
  [/^(\d+) phone par purani app$/, m => `${m[1]} فون پر پرانی ایپ`],
  [/^(\d+) "bina bataye gaya" ticket ka faisla baqi$/, m => `${m[1]} "بغیر بتائے گیا" ٹکٹ کا فیصلہ باقی`],
  [/^(\d+) likhai phone mein ruki$/, m => `${m[1]} لکھائی فون میں رکی`],
  [/^(\d+) abhi bahar hain$/, m => `${m[1]} ابھی باہر ہیں`],
  [/^(\d+) khane ke break par$/, m => `${m[1]} کھانے کے وقفے پر`],
  [/^(\d+) ka break shuru karein$/, m => `${m[1]} کا وقفہ شروع کریں`],
  [/^\((\d+) chune\)$/, m => `(${m[1]} چنے)`],
  [/^(\d+) staff$/, m => `${m[1]} ملازم`],
  [/^(\d+) record$/, m => `${m[1]} ریکارڈ`],
  [/^(\d+) din$/, m => `${m[1]} دن`],
  [/^(\d+) ki poori hazri$/, m => `${m[1]} کی پوری حاضری`],
  [/^Purani requests \((\d+)\)$/, m => `پرانی درخواستیں (${m[1]})`],
  [/^Aakhri (\d+) tabdeeliyan\.$/, m => `آخری ${m[1]} تبدیلیاں۔`],
  [/^(\d+) larkon ka (\d+) min ka break shuru$/, m => `${m[1]} لڑکوں کا ${m[2]} منٹ کا وقفہ شروع`],
  [/^Sab se zyada late: (.+) \((\d+)\)$/, m => `سب سے زیادہ دیر: ${L(m[1])} (${m[2]})`],
  // waqt / ghante
  [/^(\d+)h (\d+)m kul kaam$/, m => `کل کام ${HM(m[1], m[2])}`],
  [/^(\d+)h (\d+)m kaam kiya$/, m => `${HM(m[1], m[2])} کام کیا`],
  [/^Asal kaam (\d+)h (\d+)m$/, m => `اصل کام ${HM(m[1], m[2])}`],
  [/^Late (\d+)m$/, m => `${m[1]} منٹ دیر`],
  [/^Late (\d+)h (\d+)m$/, m => `${HM(m[1], m[2])} دیر`],
  [/^LATE · (\d+) min$/, m => `دیر · ${m[1]} منٹ`],
  [/^(\d+)h duty$/, m => `${m[1]} گھنٹے ڈیوٹی`],
  [/^(\d+)h (\d+)m duty$/, m => `${HM(m[1], m[2])} ڈیوٹی`],
  [/^(\d+)h (\d+)m roz$/, m => `روزانہ ${HM(m[1], m[2])}`],
  [/^(\d+) min baqi$/, m => `${m[1]} منٹ باقی`],
  [/^(\d+) min zyada$/, m => `${m[1]} منٹ زیادہ`],
  [/^Aaya (\d.+)$/, m => `آیا ${L(m[1])}`],
  [/^Gaya (\d.+)$/, m => `گیا ${L(m[1])}`],
  [/^Duty (\d.+)$/, m => `ڈیوٹی ${L(m[1])}`],
  [/^Server (\d.+)$/, m => `سرور ${L(m[1])}`],
  [/^Abhi · (\d.+)$/, m => `ابھی · ${L(m[1])}`],
  [/^Shak · (\d.+)$/, m => `شک · ${L(m[1])}`],
  [/^Abhi (v\d+)$/, m => `ابھی ${L(m[1])}`],
  [/^(\d[\d: apm]+) gaya · (\d[\d: apm]+) tak$/, m => `${L(m[1])} گیا · ${L(m[2])} تک`],
  [/^Bahar (\d.+) \((\d+) min\)$/, m => `باہر ${L(m[1])} (${m[2]} منٹ)`],
  [/^Default duty \((.+)\)$/, m => `ڈیفالٹ ڈیوٹی (${L(m[1])})`],
  [/^Test chal raha hai · (.+)$/, m => `ٹیسٹ چل رہا ہے · ${L(m[1])}`],
  // paisa
  [/^Salary Rs ([\d,]+)$/, m => `تنخواہ Rs ${m[1]}`],
  [/^[Bb]aqi Rs ([\d,]+)$/, m => `باقی Rs ${m[1]}`],
  [/^Apni salary Rs ([\d,]+)$/, m => `اپنی تنخواہ Rs ${m[1]}`],
  [/^Default salary: Rs ([\d,]+)$/, m => `ڈیفالٹ تنخواہ: Rs ${m[1]}`],
  [/^Default salary \(Rs ([\d,]+)\)$/, m => `ڈیفالٹ تنخواہ (Rs ${m[1]})`],
  [/^Katauti Rs ([\d,]+)$/, m => `کٹوتی Rs ${m[1]}`],
  [/^Ticket: Katauti Rs ([\d,]+) \((.+)\)$/, m => `ٹکٹ: کٹوتی Rs ${m[1]} (${L(m[2])})`],
  [/^Ticket: Warning \((.+)\)$/, m => `ٹکٹ: وارننگ (${L(m[1])})`],
  [/^Ticket: Maaf \((.+)\)$/, m => `ٹکٹ: معاف (${L(m[1])})`],
  [/^Bill cancel hua → Rs ([\d,]+)$/, m => `بل منسوخ ہوا → Rs ${m[1]}`],
  [/^Bill badla → Rs ([\d,]+)$/, m => `بل بدلا → Rs ${m[1]}`],
  [/^Bill #(\S+) · Rs ([\d,]+)$/, m => `بل #${m[1]} · Rs ${m[2]}`],
  [/^Cash Received · Bill #(\S+) · Rs ([\d,]+)$/, m => `کیش وصول · بل #${m[1]} · Rs ${m[2]}`],
  [/^Bill cancel hua: #(\S+) · Rs ([\d,]+)$/, m => `بل منسوخ ہوا: #${m[1]} · Rs ${m[2]}`],
  // jagah / camera
  [/^(\d+)m dukaan se$/, m => `دکان سے ${m[1]} میٹر`],
  [/^Aap dukaan se ([\d.]+) (km|m) door hain$/, m => `آپ دکان سے ${m[1]} ${m[2] === 'km' ? 'کلومیٹر' : 'میٹر'} دور ہیں`],
  [/^Selfie aur location lagegi\. Dukaan se (\d+)m ke andar hona zaroori hai\.$/, m => `سیلفی اور لوکیشن لگے گی۔ دکان سے ${m[1]} میٹر کے اندر ہونا ضروری ہے۔`],
  [/^(Online|Offline|Band) · (.+)$/, m => `${UR[m[1]]} · ${sub(m[2])}`],
  [/^✅ (\d+) camera jude$/, m => `✅ ${m[1]} کیمرے جڑے`],
  [/^(\d+) camera jude$/, m => `${m[1]} کیمرے جڑے`],
  [/^(.+) · nigrani (chalu|band)$/, m => `${L(m[1])} · نگرانی ${m[2] === 'chalu' ? 'چالو' : 'بند'}`],
  [/^(.+) · recording (chalu|band)$/, m => `${L(m[1])} · ریکارڈنگ ${m[2] === 'chalu' ? 'چالو' : 'بند'}`],
  [/^Manager panel · (.+)$/, m => `منیجر پینل · ${L(m[1])}`]
];

const cache = new Map();
/** Roman matn ka Urdu ('' = tarjuma nahi). */
export function urduFor(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 220 || !/[A-Za-z]/.test(t)) return '';
  if (cache.has(t)) return cache.get(t);
  let u = UR[t] || '';
  if (!u) for (const [re, fn] of PATTERNS) { const m = re.exec(t); if (m) { u = fn(m) || ''; if (u) break; } }
  if (cache.size > 4000) cache.clear();
  cache.set(t, u);
  return u;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'UR-S', 'UR-P', 'OPTION', 'SELECT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'CANVAS', 'VIDEO']);
const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'SPAN', 'A', 'BDI', 'U', 'SMALL']);
const STACK = new Set(['LABEL', 'LEGEND', 'SUMMARY', 'BUTTON', 'TH']);
const tag = n => String(n.tagName || '').toUpperCase();
const inline = c => INLINE.has(tag(c)) || ((tag(c) === 'BUTTON' || tag(c) === 'A') && /link/.test(String(c.className || '')));
/** Element ka matn, hamari apni Urdu lines ke baghair. */
function textOf(el) {
  let s = '';
  for (const c of el.childNodes) {
    if (c.nodeType === 3) s += c.textContent;
    else if (c.nodeType === 1 && !SKIP.has(tag(c))) s += textOf(c);
  }
  return s;
}

/** root ke andar har matn ke neeche Urdu ki line (jo pehle lag chuki ho wo dobara nahi). */
export function decorate(root) {
  if (!root || root.nodeType !== 1) return;
  const doc = root.ownerDocument;
  const line = (u, blk) => { const s = doc.createElement('ur-s'); s.setAttribute('lang', 'ur'); s.setAttribute('dir', 'rtl'); if (blk) s.className = 'blk'; s.textContent = u; return s; };
  const walk = el => {
    if (SKIP.has(tag(el)) || el.hasAttribute?.('data-no-ur')) return;
    const kids = [...el.childNodes];
    let texts = 0, elems = 0, done = false;
    for (const c of kids) {
      if (c.nodeType === 3) { if (c.textContent.trim()) texts++; }
      else if (c.nodeType === 1) { if (tag(c) === 'UR-S') done = true; else if (!SKIP.has(tag(c)) && /[A-Za-z]/.test(textOf(c))) elems++; }
    }
    let whole = false;                          // behta hua jumla (matn ... <b>...</b> ... matn): us ke tukron ko alag alag Urdu nahi
    if (texts && (elems || texts > 1)) {        // mila-jula jumla: poore jumle ka tarjuma ho to aakhir mein aik line
      if (done) return;
      const u = urduFor(textOf(el));
      if (u) { el.appendChild(line(u, true)); return; }
      whole = !STACK.has(tag(el));            // label / button mein tukre oopar-neeche hote hain — wahan har tukra alag theek hai
    }
    for (const c of kids) {
      if (c.nodeType === 1) { if (!whole || !inline(c)) walk(c); }
      else if (!whole && c.nodeType === 3 && c.textContent.trim()) {
        const u = urduFor(c.textContent);
        if (!u) continue;
        const pair = doc.createElement('ur-p');
        el.insertBefore(pair, c); pair.appendChild(c); pair.appendChild(line(u, false));
      }
    }
  };
  const p = root.parentElement;
  if (p && inline(root) && flowing(p)) return;  // behte hue jumle ka andar ka tukra akela aaya (sheet ka refresh) — jumla na toote
  walk(root);
}

/** Behta hua jumla (matn ke beech <b> / link) jis ka poora tarjuma lughat mein nahi — is ke tukron ko alag alag Urdu nahi lagti. */
function flowing(el) {
  if (STACK.has(tag(el)) || SKIP.has(tag(el))) return false;
  let texts = 0, elems = 0;
  for (const c of el.childNodes) {
    if (c.nodeType === 3) { if (c.textContent.trim()) texts++; }
    else if (c.nodeType === 1 && !SKIP.has(tag(c)) && /[A-Za-z]/.test(textOf(c))) elems++;
  }
  return !!texts && (elems > 0 || texts > 1) && !urduFor(textOf(el));
}

/** Hamari Urdu lines hata kar asal matn wapas (band karne par). */
export function undecorate(root) {
  if (!root?.querySelectorAll) return;
  for (const s of [...root.querySelectorAll('ur-s')]) s.remove();
  for (const p of [...root.querySelectorAll('ur-p')]) { while (p.firstChild) p.parentNode.insertBefore(p.firstChild, p); p.remove(); }
}

const KEY = 'nt-urdu-v1';
/** Urdu chalu hai? (har phone ki apni pasand; na likha ho = chalu). */
export function urduOn(storage) { try { return storage?.getItem(KEY) !== '0'; } catch { return true; } }
export function setUrdu(storage, on) { try { storage?.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ } }

/** App shuru hote hi: poore document par nazar — jo bhi naya matn bane us par Urdu. Wapas: rok dene wala function. */
export function startUrdu({ doc, storage, win } = {}) {
  if (!doc?.body) return () => {};
  if (!urduOn(storage)) { doc.documentElement.classList.remove('ur-on'); undecorate(doc.body); return () => {}; }
  doc.documentElement.classList.add('ur-on');
  decorate(doc.body);
  const MO = win?.MutationObserver || globalThis.MutationObserver;
  if (!MO) return () => {};
  // v238: Urdu FORAN (MutationObserver ka callback screen paint hone se pehle chalta hai). Pehle setTimeout tha — browser beech mein
  // bina Urdu wali screen dikha deta, phir Urdu lagti, page ooncha hota = har render par "pharakna" (app kholte waqt kai render).
  let queued = new Set();
  const flush = () => { const list = [...queued]; queued = new Set(); for (const el of list) if (el.isConnected !== false) decorate(el); };
  const mo = new MO(records => {
    for (const r of records) {
      if (r.type === 'characterData') { const p = r.target.parentElement; if (p && tag(p) !== 'UR-S' && tag(p) !== 'UR-P') queued.add(p); continue; }
      for (const n of r.addedNodes) {
        if (n.nodeType === 1) { if (tag(n) !== 'UR-S' && tag(n) !== 'UR-P') queued.add(n); }
        else if (n.nodeType === 3 && r.target?.nodeType === 1 && tag(r.target) !== 'UR-S' && tag(r.target) !== 'UR-P') queued.add(r.target);
      }
    }
    if (queued.size) flush();   // hamari apni lagayi ur-s / ur-p upar hi chhor di jati hain — dobara chakkar nahi
  });
  mo.observe(doc.body, { childList: true, subtree: true, characterData: true });
  return () => { mo.disconnect(); doc.documentElement.classList.remove('ur-on'); undecorate(doc.body); };
}
