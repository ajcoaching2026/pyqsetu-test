# PYQSetu — AJ हिंGLISH Academy

राजस्थान की परीक्षाओं (RPSC / RSSB) के PYQ — टॉपिक-वाइज़ **Practice** और **Test**।

## फ़ोल्डर
| फ़ाइल | काम |
|---|---|
| `index.html` | वेबसाइट का मुख्य पेज |
| `css/style.css` | पूरी थीम (रंग, बटन, कार्ड) — सबसे ऊपर `:root` में सारे रंग |
| `js/config.js` | **साइट का नाम, Telegram लिंक, टेस्ट की marking** — यहीं बदलें |
| `js/app.js` | Home, विषय, टॉपिक, Practice पेज |
| `js/exam.js` | Test इंजन (Instructions → Test → Result → Review) |
| `data/catalog.json` | सारे विषय, टॉपिक और Mock Tests की सूची |
| `data/topics/*.json` | हर टॉपिक के प्रश्न |
| `data/mocks/*.json` | Full Mock Tests |
| `tools/build_data.py` | Excel → JSON बनाने वाली स्क्रिप्ट |

## GitHub पर Live करना
1. GitHub पर नया repository बनाएँ (जैसे `pyqsetu`) — Public रखें।
2. इस ZIP की सारी फ़ाइलें (फ़ोल्डर समेत) उसमें Upload करें।
3. **Settings → Pages → Branch: main → / (root) → Save**
4. 1–2 मिनट बाद साइट खुलेगी: `https://<username>.github.io/pyqsetu/`

## बाद में अपना Domain जोड़ना
Settings → Pages → Custom domain में नाम डालें, और domain कंपनी की DNS में GitHub के A-records जोड़ें। कोड नहीं बदलना पड़ेगा।

## नए प्रश्न जोड़ना
Excel (Master sheet) में `Subject` और `Board` (RPSC/RSSB) कॉलम भरें → `tools/build_data.py` से JSON बनाएँ → `data/` फ़ोल्डर में upload करें।
सही उत्तर हमेशा `Final_Ans` (1/2/3/4) कॉलम से लिया जाता है।
