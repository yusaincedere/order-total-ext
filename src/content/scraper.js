// Expose a single function in page context
window.__scrapePrices = function (selector) {
  const els = Array.from(document.querySelectorAll(selector));
  const texts = els.map(el => el.textContent.trim()).filter(Boolean);

  const parseAmount = (s) => {
    let t = s.replace(/\s+/g, "");
    const raw = s;

    const match = t.match(/-?\d[\d.,]*/);
    if (!match) return { value: NaN, raw };
    t = match[0];

    const hasDot = t.includes(".");
    const hasComma = t.includes(",");

    if (hasDot && hasComma && t.lastIndexOf(",") > t.lastIndexOf(".")) {
      // EU style: 1.234,56
      t = t.replace(/\./g, "").replace(",", ".");
    } else if (hasComma && !hasDot) {
      // Maybe decimal comma
      const parts = t.split(",");
      if (parts.length === 2 && parts[1].length <= 2) {
        t = parts[0].replace(/\./g, "") + "." + parts[1];
      } else {
        t = t.replace(/,/g, "");
      }
    } else {
      // US style: remove thousand separators
      t = t.replace(/,/g, "");
    }

    const value = parseFloat(t);
    return { value, raw };
  };

  const parsed = texts.map(parseAmount);
  const total = parsed.reduce((sum, p) => (isFinite(p.value) ? sum + p.value : sum), 0);
  const count = parsed.filter(p => isFinite(p.value)).length;

  const first = texts[0] || "";
  const sym = (first.match(/[₺$€£¥]|USD|EUR|TRY|GBP|JPY/i)?.[0] || "₺").replace(/USD|EUR|TRY|GBP|JPY/i, "");
  const suffix = /USD|EUR|TRY|GBP|JPY/i.test(first) ? first.match(/USD|EUR|TRY|GBP|JPY/i)[0] : "";

  return { total, count, samples: texts.slice(0, 5), currencySymbol: sym, currencySuffix: suffix };
};
