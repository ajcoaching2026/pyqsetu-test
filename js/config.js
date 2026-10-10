// =============================================
// PYQSetu — SITE SETTINGS
// Naam, link ya marking badalni ho to sirf yahin badlein.
// =============================================
const SITE = {
  NAME_A: "PYQ",            // logo ke paas pehla hissa (neela/kaala)
  NAME_B: "Setu",           // doosra hissa (orange)
  ACADEMY: "AJ हिंGLISH Academy",
  TAGLINE: "ज्ञान • Growth • Success",
  TELEGRAM_URL: "https://t.me/AJHinglishAcademy",

  PRACTICE_PER_PAGE: 10,

  // Topic-wise test ke niyam (Mock tests apni Excel settings se chalte hain)
  TOPIC_TEST: {
    SIZES: [10, 20, 0],     // 0 = saare prashn
    POSITIVE: 1,
    NEGATIVE: 1 / 3,
    SECONDS_PER_Q: 60,
    OPTION_E: "अनुत्तरित प्रश्न"
  },

  // Security: live par true rakhein (copy / right-click band)
  PROTECT_CONTENT: false
};
