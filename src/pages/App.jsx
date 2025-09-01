import { useEffect, useState } from "react";
import calcUrl from "../assets/calc.svg";

const THEMES = ["theme-pink", "theme-ocean", "theme-graphite", "theme-mint"];

export default function App() {
  const [theme, setTheme] = useState(THEMES[0]);
  const [selector, setSelector] = useState(".item-price");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchCount, setMatchCount] = useState(null);

  // load per-host selector + theme
  useEffect(() => {
    (async () => {
      try {
        if (chrome?.tabs && chrome?.storage) {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          const host = tab?.url ? new URL(tab.url).host : "";
          const key = `selector:${host}`;
          const { [key]: savedSel, theme: savedTheme } =
            await chrome.storage.sync.get([key, "theme"]);
          if (savedSel) setSelector(savedSel);
          if (savedTheme && THEMES.includes(savedTheme)) setTheme(savedTheme);
        }
      } catch {}
    })();
  }, []);

  async function persistTheme(next) {
    try {
      await chrome?.storage?.sync?.set?.({ theme: next });
    } catch {}
  }

  function cycleTheme() {
    const idx = THEMES.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
    persistTheme(next);
  }

  async function testSelector() {
    try {
      setMatchCount(null);
      setError("");
      if (!chrome?.tabs || !chrome?.scripting)
        throw new Error("Chrome APIs unavailable.");
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) throw new Error("No active tab.");

      const [{ result: count }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => (sel ? document.querySelectorAll(sel).length : 0),
        args: [selector],
      });
      setMatchCount(Number(count || 0));
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  async function handleCalculate() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      if (!chrome?.tabs || !chrome?.scripting || !chrome?.storage) {
        throw new Error(
          "Chrome extension APIs not available. Run the built extension, not dev server."
        );
      }
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id || !tab?.url) throw new Error("No active tab found.");

      const host = new URL(tab.url).host;
      await chrome.storage.sync.set({ [`selector:${host}`]: selector });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/scraper.js"],
      });

      const [{ result: data }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) =>
          window.__scrapePrices ? window.__scrapePrices(sel) : null,
        args: [selector],
      });

      setResult(data);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const avg =
    result && result.count > 0
      ? Number(result.total || 0) / Number(result.count || 1)
      : 0;

  function copyTotal() {
    if (!result) return;
    const text = `${result.currencySymbol}${Number(result.total ?? 0).toFixed(
      2
    )} ${result.currencySuffix || ""}`.trim();
    navigator.clipboard?.writeText(text);
  }

  // place this near top of the file
  function HeaderIcon({ className }) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        {/* magnifier */}
        <circle
          cx="10"
          cy="10"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="15.5"
          y="15.5"
          width="6"
          height="2.6"
          rx="1.3"
          transform="rotate(45 15.5 15.5)"
          fill="currentColor"
        />
        {/* receipt inside lens */}
        <rect
          x="6.7"
          y="7.6"
          width="6.6"
          height="4.4"
          rx="1"
          fill="currentColor"
          opacity="0.13"
        />
        <rect
          x="7.3"
          y="8.4"
          width="5.0"
          height="0.9"
          rx="0.45"
          fill="currentColor"
        />
        <rect
          x="7.3"
          y="9.9"
          width="4.2"
          height="0.9"
          rx="0.45"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <div className={`container compact ${theme}`}>
      <div className="card">
        <div className="header">
          <div className="header-left">
            <HeaderIcon className="brand-icon-svg" />
            <h2 className="h1">Expense Lens</h2>
          </div>

          <div className="header-actions">
            <button
              className="chip"
              onClick={cycleTheme}
              title="Switch theme"
              aria-label="Switch theme"
            >
              Theme
            </button>

            <span
              className="info-badge"
              tabIndex={0}
              title="How it works"
              aria-label="Info"
            >
              i
              <span className="tooltip">
                Sum prices matched by your CSS selector on this page. Ensure
                lists are fully loaded (scroll/open next page) before
                calculating.
              </span>
            </span>
          </div>
        </div>

        <div className="row">
          <label className="label" htmlFor="selector-input">
            CSS selector for price elements
          </label>
          <input
            id="selector-input"
            className="input mono"
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCalculate();
            }}
            placeholder=".item-price"
            spellCheck="false"
          />

          <div className="actions">
            <button
              onClick={testSelector}
              className="secondary-btn"
              disabled={loading}
            >
              Test selector{matchCount !== null ? ` • ${matchCount}` : ""}
            </button>
            <button
              onClick={handleCalculate}
              disabled={loading}
              className="primary-btn"
              aria-busy={loading}
            >
              {loading ? "Calculating…" : "Calculate Total"}
            </button>
          </div>

          {error && (
            <div className="error" role="alert">
              ⚠ {error}
            </div>
          )}

          {result && (
            <div className="result">
              <div className="total">
                {result.currencySymbol}
                {Number(result.total ?? 0).toFixed(2)} {result.currencySuffix}
              </div>
              <div className="subtle">
                Found {result.count} prices · Avg {result.currencySymbol}
                {avg.toFixed(2)} {result.currencySuffix}
              </div>
              <div className="result-actions">
                <button className="chip" onClick={copyTotal} title="Copy total">
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="footer">
            Tip: narrow selector if you’re catching per-item prices. Example:{" "}
            <kbd>.order-box .item-price:last-of-type</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
