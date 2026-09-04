# Noor Traders Hisab — Firebase Setup

## جو کام مکمل ہو چکے ہیں
- Firebase Web App registered
- Cloud Firestore created
- Email/Password Authentication enabled
- GitHub Pages domain authorized
- Firestore rules require authenticated user

## اب Firebase Authentication میں پہلا user بنائیں
1. Firebase Console → Authentication
2. Users tab
3. Add user
4. اپنا Email اور ایک مضبوط Password درج کریں
5. Add user

Public Sign Up اس app میں شامل نہیں کیا گیا۔ صرف Firebase Console میں بنائے گئے users login کر سکیں گے۔

## GitHub پر upload
اس ZIP کے اندر کی تمام files repository root میں upload/replace کریں:
- index.html
- assets/
- manifest.webmanifest
- sw.js
- firestore.rules
- README.md
- .github/workflows/pages.yml

## Online data structure
Firestore:
- businesses/noor-traders/settings/main
- businesses/noor-traders/entries/*
- businesses/noor-traders/entryPictures/*
- businesses/noor-traders/staff/*
- businesses/noor-traders/purchases/*
- businesses/noor-traders/purchasePictures/*
- businesses/noor-traders/batches/*
- businesses/noor-traders/attendance/*
- businesses/noor-traders/stockRecords/*

## Important
- Browser localStorage offline/local cache کے طور پر رہتا ہے۔
- پہلی دفعہ cloud خالی ہو تو موجود local data Firebase پر seed ہو جاتا ہے۔
- اگر cloud میں data موجود ہو تو login کے بعد cloud data app میں load ہوتا ہے۔
- Pictures Firestore میں الگ documents میں رکھی گئی ہیں تاکہ بڑے combined document کی 1 MiB limit سے بچا جا سکے۔
