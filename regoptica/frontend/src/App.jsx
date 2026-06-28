import { useState, useRef } from "react";

// ✅ STEP 1: After deploying backend on Railway, paste your URL here
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const SAMPLE_OBLIGATIONS = [
  {
    id: 1,
    code: "SC/KYC/001",
    obligation: "Stockbrokers must verify client KYC documents within 2 working days of account opening",
    department: "KYC & Onboarding",
    deadline: "2025-07-15",
    frequency: "Per new client",
    evidence: "KYC verification report, client consent form",
    priority: "High",
    status: "Pending",
    circular: "SEBI Master Circular 2024",
  },
  {
    id: 2,
    code: "SC/RPT/002",
    obligation: "Submit monthly margin utilization report to SEBI by 7th of every month",
    department: "Risk & Reporting",
    deadline: "2025-07-07",
    frequency: "Monthly",
    evidence: "Signed margin report, system-generated summary",
    priority: "Critical",
    status: "Overdue",
    circular: "SEBI Circular CIR/2024/45",
  },
  {
    id: 3,
    code: "SC/GRV/003",
    obligation: "Resolve client grievances within 30 days of receipt and update SCORES portal",
    department: "Investor Relations",
    deadline: "2025-07-20",
    frequency: "Per grievance",
    evidence: "SCORES portal screenshot, resolution letter",
    priority: "High",
    status: "In Progress",
    circular: "SEBI Master Circular 2024",
  },
  {
    id: 4,
    code: "SC/FND/004",
    obligation: "Maintain client fund segregation and submit daily fund utilization statement",
    department: "Finance & Accounts",
    deadline: "2025-07-01",
    frequency: "Daily",
    evidence: "Bank statement, fund segregation certificate",
    priority: "Critical",
    status: "Compliant",
    circular: "SEBI Circular CIR/2024/12",
  },
];

const PRIORITY_COLORS = {
  Critical: { bg: "#FEE2E2", text: "#DC2626" },
  High: { bg: "#FEF3C7", text: "#D97706" },
  Medium: { bg: "#DBEAFE", text: "#2563EB" },
  Low: { bg: "#DCFCE7", text: "#16A34A" },
};

const STATUS_COLORS = {
  Compliant: { bg: "#DCFCE7", text: "#15803D" },
  "In Progress": { bg: "#DBEAFE", text: "#1D4ED8" },
  Pending: { bg: "#FEF9C3", text: "#A16207" },
  Overdue: { bg: "#FEE2E2", text: "#B91C1C" },
};

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [obligations, setObligations] = useState(SAMPLE_OBLIGATIONS);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState([]);
  const [fileName, setFileName] = useState("");
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [toast, setToast] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const fileRef = useRef();
  const chatRef = useRef();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const stats = {
    total: obligations.length,
    compliant: obligations.filter((o) => o.status === "Compliant").length,
    overdue: obligations.filter((o) => o.status === "Overdue").length,
    pending: obligations.filter((o) => o.status === "Pending").length,
  };

  const complianceScore = Math.round((stats.compliant / stats.total) * 100);

  // ── EXTRACT from backend ──────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setExtracting(true);
    setExtracted([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${BACKEND_URL}/extract`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.obligations?.length > 0) {
        const withMeta = data.obligations.map((o, i) => ({
          ...o,
          id: Date.now() + i,
          status: "Pending",
          circular: file.name,
        }));
        setExtracted(withMeta);
        showToast(`${withMeta.length} obligations extracted from ${file.name}`);
      } else {
        showToast(data.error || "No obligations found", "error");
      }
    } catch (err) {
      showToast("Backend not reachable. Check Railway deployment.", "error");
    }

    setExtracting(false);
  };

  const addToTracker = (ob) => {
    setObligations((prev) => [...prev, ob]);
    showToast(`${ob.code} added to tracker`);
  };

  const updateStatus = (id, status) => {
    setObligations((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    showToast(`Status updated to ${status}`);
  };

  // ── ASK ASSISTANT from backend ────────────────────────────────────
  const askQuestion = async () => {
    if (!question.trim()) return;
    setAsking(true);
    const userMsg = question;
    setQuestion("");
    setChatHistory((prev) => [...prev, { role: "user", text: userMsg }]);

    try {
      const context = obligations
        .map((o) => `${o.code}: ${o.obligation} | Status: ${o.status} | Deadline: ${o.deadline} | Dept: ${o.department}`)
        .join("\n");

      const res = await fetch(`${BACKEND_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMsg, context }),
      });

      const data = await res.json();
      setChatHistory((prev) => [...prev, { role: "assistant", text: data.answer }]);
    } catch {
      setChatHistory((prev) => [...prev, { role: "assistant", text: "Cannot reach backend. Check Railway deployment." }]);
    }

    setAsking(false);
    setTimeout(() => chatRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 100);
  };

  const filtered = filterStatus === "All" ? obligations : obligations.filter((o) => o.status === filterStatus);

  // ── UI ────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#F0F4FF", minHeight: "100vh", color: "#1a1a2e" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.type === "error" ? "#DC2626" : "#15803D", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, boxShadow: "0 2px 20px rgba(30,58,138,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚖️</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>RegOptica</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>SEBI Compliance Intelligence</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { key: "dashboard", label: "📊 Dashboard" },
            { key: "extract", label: "📄 Extract" },
            { key: "tracker", label: "✅ Tracker" },
            { key: "assistant", label: "🤖 AI Assistant" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ background: tab === t.key ? "rgba(255,255,255,0.2)" : "transparent", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 400 }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>Compliance Overview</div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Live SEBI compliance status for your stockbroker operations</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, marginBottom: 24 }}>
              {/* Score Ring */}
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12, fontWeight: 600 }}>Compliance Score</div>
                <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 12px" }}>
                  <svg viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke={complianceScore >= 70 ? "#16A34A" : "#DC2626"} strokeWidth="10"
                      strokeDasharray={`${2 * Math.PI * 50 * complianceScore / 100} ${2 * Math.PI * 50}`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: complianceScore >= 70 ? "#16A34A" : "#DC2626" }}>{complianceScore}%</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>of obligations met</div>
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { label: "Total Obligations", value: stats.total, color: "#1e3a8a", bg: "#EFF6FF", icon: "📋" },
                  { label: "Compliant", value: stats.compliant, color: "#15803D", bg: "#F0FDF4", icon: "✅" },
                  { label: "Overdue", value: stats.overdue, color: "#DC2626", bg: "#FEF2F2", icon: "🚨" },
                  { label: "Pending Action", value: stats.pending, color: "#D97706", bg: "#FFFBEB", icon: "⏳" },
                ].map((s) => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "20px 24px", border: `1px solid ${s.color}20` }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Alerts */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e3a8a", marginBottom: 16 }}>🚨 Needs Immediate Attention</div>
              {obligations.filter((o) => o.status === "Overdue" || o.priority === "Critical").slice(0, 3).map((o) => (
                <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#FEF2F2", borderRadius: 10, marginBottom: 10, border: "1px solid #FECACA" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a" }}>{o.code} — {o.department}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{o.obligation.slice(0, 90)}...</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>Due: {o.deadline}</span>
                    <button onClick={() => setTab("tracker")} style={{ background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      Resolve →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── EXTRACT ── */}
        {tab === "extract" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>Extract from SEBI Circular</div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Upload any SEBI circular PDF — AI extracts all compliance obligations instantly</div>
            </div>

            <div
              onClick={() => fileRef.current.click()}
              style={{ background: "#fff", border: "2px dashed #93C5FD", borderRadius: 16, padding: "52px 32px", textAlign: "center", cursor: "pointer", marginBottom: 24, transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.background = "#EFF6FF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#fff"; }}
            >
              <div style={{ fontSize: 44, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1e3a8a", marginBottom: 6 }}>
                {fileName ? `✅ ${fileName}` : "Upload SEBI Circular PDF"}
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Click to browse · Supports PDF files</div>
              <input ref={fileRef} type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: "none" }} />
            </div>

            {extracting && (
              <div style={{ background: "#EFF6FF", borderRadius: 14, padding: 28, textAlign: "center", border: "1px solid #BFDBFE", marginBottom: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e3a8a" }}>RegOptica AI is reading the circular...</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Extracting obligations, deadlines, departments & evidence</div>
                <div style={{ marginTop: 16, height: 4, background: "#DBEAFE", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "linear-gradient(90deg, #2563EB, #60A5FA)", borderRadius: 4, animation: "progress 2s ease-in-out infinite" }} />
                </div>
              </div>
            )}

            {extracted.length > 0 && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e3a8a", marginBottom: 14 }}>✅ {extracted.length} Obligations Extracted</div>
                {extracted.map((o) => (
                  <div key={o.id} style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ background: "#EFF6FF", color: "#1e3a8a", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>{o.code}</span>
                        <span style={{ background: PRIORITY_COLORS[o.priority]?.bg, color: PRIORITY_COLORS[o.priority]?.text, fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 6 }}>{o.priority}</span>
                      </div>
                      <button onClick={() => addToTracker(o)} style={{ background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                        + Add to Tracker
                      </button>
                    </div>
                    <div style={{ fontSize: 14, color: "#1e293b", marginBottom: 12, lineHeight: 1.6 }}>{o.obligation}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                      {[{ l: "Department", v: o.department }, { l: "Deadline", v: o.deadline }, { l: "Frequency", v: o.frequency }].map((f) => (
                        <div key={f.l} style={{ background: "#F8FAFC", borderRadius: 8, padding: "8px 12px" }}>
                          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{f.l}</div>
                          <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 600, marginTop: 2 }}>{f.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "#F0FDF4", borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ fontSize: 11, color: "#15803D", fontWeight: 700 }}>📎 Evidence: </span>
                      <span style={{ fontSize: 12, color: "#374151" }}>{o.evidence}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TRACKER ── */}
        {tab === "tracker" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>Obligation Tracker</div>
                <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Track and fulfil every SEBI obligation with full audit trail</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["All", "Compliant", "In Progress", "Pending", "Overdue"].map((s) => (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{ background: filterStatus === s ? "#1e3a8a" : "#fff", color: filterStatus === s ? "#fff" : "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontWeight: filterStatus === s ? 700 : 400 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {filtered.map((o) => (
              <div key={o.id} style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: `1px solid ${o.status === "Overdue" ? "#FECACA" : "#e2e8f0"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ background: "#EFF6FF", color: "#1e3a8a", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6 }}>{o.code}</span>
                      <span style={{ background: PRIORITY_COLORS[o.priority]?.bg, color: PRIORITY_COLORS[o.priority]?.text, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}>{o.priority}</span>
                      <span style={{ background: STATUS_COLORS[o.status]?.bg, color: STATUS_COLORS[o.status]?.text, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}>{o.status}</span>
                      <span style={{ background: "#F1F5F9", color: "#475569", fontSize: 11, padding: "3px 8px", borderRadius: 6 }}>{o.department}</span>
                    </div>
                    <div style={{ fontSize: 14, color: "#1e293b", marginBottom: 8, lineHeight: 1.5 }}>{o.obligation}</div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>📅 <strong>{o.deadline}</strong></span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>🔁 {o.frequency}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>📌 {o.circular}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>📎 {o.evidence}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 16, flexShrink: 0 }}>
                    <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}
                      style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 12, cursor: "pointer", background: "#F8FAFC" }}>
                      {["Pending", "In Progress", "Compliant", "Overdue"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => { updateStatus(o.id, "Compliant"); showToast(`Evidence recorded for ${o.code}`); }}
                      style={{ background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      📎 Mark Evidenced
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── AI ASSISTANT ── */}
        {tab === "assistant" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>RegOptica AI Assistant</div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Ask anything about your SEBI compliance obligations — powered by Claude</div>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div ref={chatRef} style={{ height: 440, overflowY: "auto", padding: 24 }}>
                {chatHistory.length === 0 && (
                  <div style={{ textAlign: "center", padding: "50px 20px" }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🤖</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1e3a8a", marginBottom: 6 }}>Ask RegOptica AI</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>Powered by Claude — your SEBI compliance co-pilot</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                      {["Which obligations are overdue?", "What evidence do I need for KYC?", "Explain margin reporting requirements", "What are SEBI penalties for non-compliance?"].map((q) => (
                        <button key={q} onClick={() => setQuestion(q)} style={{ background: "#EFF6FF", color: "#1e3a8a", border: "1px solid #BFDBFE", borderRadius: 20, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 16, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "75%", background: msg.role === "user" ? "#1e3a8a" : "#F8FAFC", color: msg.role === "user" ? "#fff" : "#1e293b", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "12px 16px", fontSize: 13, lineHeight: 1.7, border: msg.role === "assistant" ? "1px solid #e2e8f0" : "none", whiteSpace: "pre-wrap" }}>
                      {msg.role === "assistant" && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontWeight: 700 }}>🤖 RegOptica AI</div>}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {asking && (
                  <div style={{ display: "flex", gap: 6, padding: "8px 0" }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ width: 8, height: 8, background: "#93C5FD", borderRadius: "50%", animation: `bounce 1s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                )}
              </div>
              <div style={{ borderTop: "1px solid #e2e8f0", padding: 16, display: "flex", gap: 10 }}>
                <input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !asking && askQuestion()}
                  placeholder="Ask about any SEBI obligation, deadline, or compliance requirement..."
                  style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", fontSize: 13, outline: "none", color: "#1e293b" }} />
                <button onClick={askQuestion} disabled={asking || !question.trim()}
                  style={{ background: asking ? "#94a3b8" : "#1e3a8a", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 13, cursor: asking ? "not-allowed" : "pointer", fontWeight: 700 }}>
                  {asking ? "..." : "Ask →"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes progress { 0%{width:0%} 50%{width:70%} 100%{width:100%} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
      `}</style>
    </div>
  );
}
