import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function Home() {
  const [tb, setTb] = useState({ headers: [], rows: [] });
  const [log, setLog] = useState([]);
  const addLog = (m) => setLog((s) => [m, ...s].slice(0, 200));

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    addLog("Reading: " + f.name);
    const data = await f.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (json.length === 0) {
      addLog("No rows found");
      return;
    }

    setTb({ headers: Object.keys(json[0]), rows: json });
    addLog(`Parsed ${json.length} rows`);
  }

  async function runPipeline() {
    if (tb.rows.length === 0) {
      alert("Upload Trial Balance first");
      return;
    }

    addLog("Uploading TB to backend...");

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    try {
      const resp = await fetch(`${backend}/api/webhook/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "TB_upload.json",
          data: tb.rows.slice(0, 500),
        }),
      });

      const j = await resp.json();
      addLog("Upload result: " + (j.status || JSON.stringify(j)));
      addLog("Running Perplexity → Gemini → ChatGPT");

      const p = await fetch(`${backend}/api/perplexity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Latest GST updates for exporters" }),
      });

      const pj = await p.json();
      addLog("Perplexity: " + (pj.summary || "OK"));

      const g = await fetch(`${backend}/api/gemini`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Explain section 16 CGST Act" }),
      });

      const gj = await g.json();
      addLog("Gemini: " + (gj.items ? gj.items.length : JSON.stringify(gj)));

      const c = await fetch(`${backend}/api/chatgpt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "draft_fs_and_notes",
          tb: tb.rows.slice(0, 500),
          research: { perplexity: pj, gemini: gj },
        }),
      });

      const cj = await c.json();
      addLog("ChatGPT output received.");
      if (cj.output)
        addLog("Preview: " + String(cj.output).slice(0, 200));
    } catch (err) {
      addLog("Error: " + String(err));
    }
  }

  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        padding: 28,
        background: "#f6fbff",
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          maxWidth: 980,
          margin: "0 auto 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: "#064e9c" }}>AgraCA • AI Dashboard</h1>
          <div style={{ color: "#6b7280" }}>
            Professional CA tools — FS, CMA, GST/IT replies
          </div>
        </div>
        <div style={{ textAlign: "right", color: "#6b7280" }}>Status: Ready</div>
      </header>

      <main
        style={{
          maxWidth: 980,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: 20,
        }}
      >
        {/* LEFT PANEL */}
        <section
          style={{
            background: "#fff",
            padding: 20,
            borderRadius: 8,
            boxShadow: "0 0 6px rgba(0,0,0,0.08)",
          }}
        >
          <h2 style={{ color: "#0b4a8b" }}>Upload Trial Balance (Excel)</h2>

          <input type="file" accept=".xls,.xlsx" onChange={handleFile} />

          <div style={{ marginTop: 12 }}>
            <button
              onClick={runPipeline}
              style={{
                background: "#0b4a8b",
                color: "#fff",
                padding: "8px 14px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              Run Full Pipeline
            </button>
          </div>

          <h3 style={{ marginTop: 18, color: "#0b4a8b" }}>Preview</h3>

          <div
            style={{
              maxHeight: 260,
              overflow: "auto",
              border: "1px solid #e6eef8",
              borderRadius: 6,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f3f8ff" }}>
                <tr>
                  {tb.headers.map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: 8,
                        fontSize: 13,
                        borderBottom: "1px solid #eef6ff",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {tb.rows.slice(0, 30).map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f1f7ff" }}>
                    {tb.headers.map((h) => (
                      <td key={h} style={{ padding: 8, fontSize: 13 }}>
                        {String(r[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside
          style={{
            background: "#fff",
            padding: 20,
            borderRadius: 8,
            boxShadow: "0 0 6px rgba(0,0,0,0.08)",
          }}
        >
          <h3 style={{ color: "#0b4a8b" }}>Activity Log</h3>

          <div style={{ maxHeight: 420, overflow: "auto", fontSize: 13 }}>
            {log.map((l, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 0",
                  borderBottom: "1px dashed #eef6ff",
                }}
              >
                {l}
              </div>
            ))}

            {log.length === 0 && (
              <div style={{ color: "#94a3b8" }}>
                No activity yet — upload a TB to begin.
              </div>
            )}
          </div>
        </aside>
      </main>

      <footer
        style={{
          maxWidth: 980,
          margin: "32px auto 0",
          color: "#6b7280",
          fontSize: 13,
        }}
      >
        Security: PII masked server-side. Use paid API keys for production.
      </footer>
    </div>
  );
}
