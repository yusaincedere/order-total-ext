import { useEffect, useState } from "react";

export default function App() {
  const [selector, setSelector] = useState(".item-price");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // load saved selector for this domain
  useEffect(() => {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const host = new URL(tab.url || "").host;
        const key = `selector:${host}`;
        const data = await chrome.storage.sync.get(key);
        if (data[key]) setSelector(data[key]);
      } catch {}
    })();
  }, []);

  async function handleCalculate() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const host = new URL(tab.url).host;
      await chrome.storage.sync.set({ [`selector:${host}`]: selector });

      // inject scraper
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/scraper.js"]
      });

      // run scraper
      const [{ result: data }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          return window.__scrapePrices ? window.__scrapePrices(sel) : null;
        },
        args: [selector]
      });

      setResult(data);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", width: 300 }}>
      <h3>Order Total Calculator</h3>

      <label style={{ fontSize: 12, color: "#666" }}>
        CSS selector for price elements
      </label>
      <input
        value={selector}
        onChange={(e) => setSelector(e.target.value)}
        placeholder=".item-price"
        style={{
          width: "100%",
          padding: "6px 8px",
          border: "1px solid #ccc",
          borderRadius: 6,
          marginBottom: 8
        }}
      />

      <button
        onClick={handleCalculate}
        disabled={loading}
        style={{
          width: "100%",
          padding: "8px",
          borderRadius: 6,
          background: "#2563eb",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
          border: "none"
        }}
      >
        {loading ? "Calculating…" : "Calculate"}
      </button>

      {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Total: {result.currencySymbol}{result.total.toFixed(2)} {result.currencySuffix}
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            Found {result.count} prices
            {result.samples?.length > 0 && (
              <>. Examples: {result.samples.slice(0, 3).join(" · ")}</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
