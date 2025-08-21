import { useEffect, useState } from "react";

function CalcIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        stroke="white"
        opacity=".9"
      />
      <rect
        x="7"
        y="7"
        width="10"
        height="4"
        rx="1.5"
        fill="white"
        opacity=".9"
      />
      <path
        d="M7 14h4M7 17h4M14.5 14v3M13 15.5h3"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const [selector, setSelector] = useState(".item-price");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load saved selector per domain, if extension env exists
  useEffect(() => {
    (async () => {
      try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.storage) {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tab?.url) {
            const host = new URL(tab.url).host;
            const key = `selector:${host}`;
            const data = await chrome.storage.sync.get(key);
            if (data[key]) setSelector(data[key]);
          }
        }
      } catch {}
    })();
  }, []);

  async function handleCalculate() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      if (!chrome?.tabs || !chrome?.scripting || !chrome?.storage) {
        throw new Error(
          "Chrome extension APIs not available. Try in extension build, not dev server."
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

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <CalcIcon className="icon" />
          <h2 style={{ marginBottom: 8 }}>Expense Lens</h2>
          <p style={{ fontSize: 12, color: "#555" }}>
            Select the price elements and calculate your total spend.
          </p>
        </div>

        <div className="infobox">
          <strong>Heads-up:</strong> This sums all prices matched by your
          selector on the current page (e.g., an order list). Make sure **all
          items are rendered** first (scroll to load more or open next page),
          then press the button again if needed.
        </div>

        <div className="row">
          <div className="label">CSS selector for price elements</div>
          <input
            className="input"
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            placeholder=".item-price"
            spellCheck="false"
          />

          <div className="actions">
            <button
              onClick={handleCalculate}
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 6,
                background: loading ? "#94a3b8" : "#2563eb", // slate gray if disabled
                color: "white",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                border: "none",
                marginTop: 8,
              }}
            >
              {loading ? "Calculating…" : "Calculate Total"}
            </button>
          </div>

          {error && <div className="error">⚠ {error}</div>}

          {result && (
            <div className="result">
              <div className="total">
                {result.currencySymbol}
                {Number(result.total ?? 0).toFixed(2)} {result.currencySuffix}
              </div>
              <div style={{ color: "var(--text)", opacity: 0.8, marginTop: 4 }}>
                Found {result.count} prices
                {result.samples?.length ? (
                  <> · {result.samples.slice(0, 3).join(" · ")}</>
                ) : null}
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
