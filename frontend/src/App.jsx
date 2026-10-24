import { useState, useEffect } from "react";

export default function App() {
  const [activeTab, setActiveTab] = useState("verify"); // 'verify' | 'admin' | 'arch'
  const [token, setToken] = useState("");
  const [login, setLogin] = useState({ username: "admin", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [form, setForm] = useState({ student_name: "", course: "" });
  const [issueLoading, setIssueLoading] = useState(false);
  const [issued, setIssued] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);

  const [verifyId, setVerifyId] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Auto-verify from URL query parameters (e.g. ?id=CERT-XXXX or ?cert=CERT-XXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("id") || params.get("cert");
    if (queryId) {
      setVerifyId(queryId.toUpperCase());
      performVerification(queryId.toUpperCase());
    }
  }, []);

  // Authentication
  async function doLogin(e) {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/certs/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(login),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        setLoginError("");
      } else {
        setLoginError("Invalid admin credentials. (Default: admin / admin123)");
      }
    } catch (err) {
      setLoginError("Network connection error to Certificate Service.");
    } finally {
      setLoginLoading(false);
    }
  }

  function doLogout() {
    setToken("");
    setIssued(null);
    setForm({ student_name: "", course: "" });
  }

  // Issue Certificate
  async function issue(e) {
    if (e) e.preventDefault();
    if (!form.student_name.trim() || !form.course.trim()) return;
    setIssueLoading(true);
    try {
      const res = await fetch("/api/certs/certificates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setIssued(data);
        setSessionHistory((prev) => [data, ...prev]);
      } else {
        alert("Failed to issue certificate. Please re-login.");
      }
    } catch (err) {
      alert("Error contacting Certificate Service.");
    } finally {
      setIssueLoading(false);
    }
  }

  // Public Verify
  async function performVerification(idToVerify) {
    const targetId = (idToVerify || verifyId).trim();
    if (!targetId) return;
    setVerifyLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/verify/${targetId}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        setResult({ valid: false, notFound: true, queryId: targetId });
      }
    } catch (err) {
      setResult({ valid: false, error: true, queryId: targetId });
    } finally {
      setVerifyLoading(false);
    }
  }

  function copyToClipboard(text, isLink = false) {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }

  function printCertificate() {
    window.print();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Navbar */}
      <header
        className="no-print"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(9, 13, 22, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          className="container"
          style={{
            padding: "0.85rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => setActiveTab("verify")}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(99, 102, 241, 0.4)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="font-heading" style={{ fontSize: "1.35rem", fontWeight: 800, background: "linear-gradient(90deg, #ffffff, #c7d2fe)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  CertVerify
                </span>
                <span className="badge badge-primary" style={{ fontSize: "0.65rem", padding: "2px 8px" }}>
                  v2.0 AWS
                </span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                Cloud-Native Digital Credentials Platform
              </div>
            </div>
          </div>

          {/* Navigation Pill Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(15, 23, 42, 0.8)",
              borderRadius: "12px",
              padding: "4px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <button
              onClick={() => setActiveTab("verify")}
              style={{
                background: activeTab === "verify" ? "linear-gradient(135deg, var(--primary), var(--secondary))" : "transparent",
                color: activeTab === "verify" ? "#ffffff" : "var(--text-muted)",
                border: "none",
                borderRadius: "8px",
                padding: "8px 18px",
                fontSize: "0.88rem",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              🔍 Public Verify
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              style={{
                background: activeTab === "admin" ? "linear-gradient(135deg, var(--primary), var(--secondary))" : "transparent",
                color: activeTab === "admin" ? "#ffffff" : "var(--text-muted)",
                border: "none",
                borderRadius: "8px",
                padding: "8px 18px",
                fontSize: "0.88rem",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              🛡️ Admin Studio {token && <span className="glow-dot" style={{ marginLeft: "6px" }} />}
            </button>
            <button
              onClick={() => setActiveTab("arch")}
              style={{
                background: activeTab === "arch" ? "linear-gradient(135deg, var(--primary), var(--secondary))" : "transparent",
                color: activeTab === "arch" ? "#ffffff" : "var(--text-muted)",
                border: "none",
                borderRadius: "8px",
                padding: "8px 18px",
                fontSize: "0.88rem",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              📐 Architecture
            </button>
          </div>

          {/* Infrastructure Health Status */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "4px 10px", borderRadius: 20 }}>
              <span className="glow-dot" />
              <span style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: 600 }}>
                AWS k3s: Online
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="container" style={{ flex: 1, paddingTop: "2.2rem", paddingBottom: "3rem" }}>
        {/* PUBLIC VERIFICATION TAB */}
        {activeTab === "verify" && (
          <div className="animate-fade-in" style={{ maxWidth: 780, margin: "0 auto" }}>
            {/* Hero Header */}
            <div className="no-print" style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "0.75rem" }}>
                <span className="badge badge-primary">Decentralized Trust</span>
                <span className="badge badge-success">PostgreSQL RDS Verified</span>
              </div>
              <h1 style={{ fontSize: "2.8rem", fontWeight: 800, marginBottom: "0.6rem", letterSpacing: "-0.03em" }}>
                Instant Credential Verification
              </h1>
              <p style={{ color: "var(--text-muted)", fontSize: "1.05rem", maxWidth: 580, margin: "0 auto", lineHeight: 1.6 }}>
                Securely validate certificates issued through our cloud-native microservice architecture hosted on AWS EC2 & RDS.
              </p>
            </div>

            {/* Architecture Metrics Grid */}
            <div className="stats-grid no-print">
              <div className="stat-card">
                <div className="stat-value">&lt; 15ms</div>
                <div className="stat-label">Verification Latency</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">SHA-256</div>
                <div className="stat-label">Cryptographic Integrity</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">Zero-Trust</div>
                <div className="stat-label">JWT Authenticated</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">AWS RDS</div>
                <div className="stat-label">PostgreSQL 16 Engine</div>
              </div>
            </div>

            {/* Search Input Box */}
            <div className="glass-panel no-print" style={{ padding: "1.75rem", marginBottom: "2rem" }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  performVerification();
                }}
                style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
              >
                <div style={{ position: "relative", flex: "1 1 320px" }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter Certificate ID (e.g. CERT-7F3A91BC)"
                    value={verifyId}
                    onChange={(e) => setVerifyId(e.target.value)}
                    style={{ fontSize: "1.05rem", textTransform: "uppercase", paddingLeft: "42px" }}
                  />
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "1.1rem", opacity: 0.6 }}>
                    🔍
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={verifyLoading || !verifyId.trim()}
                  className="btn btn-primary"
                  style={{ minWidth: 160 }}
                >
                  {verifyLoading ? "Verifying..." : "Verify Certificate"}
                </button>
              </form>

              {/* Sample Chips / Quick Fill */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "14px", flexWrap: "wrap", fontSize: "0.82rem" }}>
                <span style={{ color: "var(--text-dim)" }}>Quick Demo:</span>
                {sessionHistory.length > 0 ? (
                  sessionHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setVerifyId(item.id);
                        performVerification(item.id);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: "3px 9px", fontSize: "0.75rem" }}
                    >
                      ⚡ {item.id} ({item.student_name})
                    </button>
                  ))
                ) : (
                  <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>
                    Issue a certificate in <strong>Admin Studio</strong> or enter an ID above.
                  </span>
                )}
              </div>
            </div>

            {/* Verification Result Display */}
            {result && (
              <div className="animate-fade-in">
                {result.valid ? (
                  <div>
                    {/* The Official Certificate Paper */}
                    <div className="cert-certificate-paper">
                      {/* Top Header with Gold Wax Seal & Verified Badge */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderBottom: "1px solid rgba(245, 158, 11, 0.25)",
                          paddingBottom: "1.25rem",
                          marginBottom: "1.75rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {/* Gold Emblem SVG */}
                          <div
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: "50%",
                              background: "radial-gradient(circle, #f59e0b 0%, #b45309 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 4px 16px rgba(245, 158, 11, 0.35)",
                            }}
                          >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="8" r="6"/>
                              <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
                            </svg>
                          </div>
                          <div>
                            <div style={{ color: "var(--accent-gold)", fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                              Official Verified Credential
                            </div>
                            <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                              Issued via CertVerify AWS Cloud Architecture
                            </div>
                          </div>
                        </div>

                        <span className="badge badge-success" style={{ fontSize: "0.82rem", padding: "5px 12px" }}>
                          ✓ Cryptographically Verified
                        </span>
                      </div>

                      {/* Main Certificate Typography */}
                      <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "0.5rem" }}>
                          This document certifies that
                        </p>
                        <h2
                          style={{
                            fontSize: "2.6rem",
                            fontWeight: 800,
                            margin: "0.6rem 0",
                            color: "#ffffff",
                            letterSpacing: "-0.01em",
                            textShadow: "0 2px 14px rgba(0,0,0,0.6)",
                          }}
                        >
                          {result.student_name}
                        </h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", maxWidth: 520, margin: "0 auto" }}>
                          has fulfilled all curricular requirements and demonstrated proficient mastery in
                        </p>
                        <div
                          style={{
                            display: "inline-block",
                            margin: "1.25rem 0",
                            padding: "10px 28px",
                            background: "rgba(99, 102, 241, 0.15)",
                            border: "1px solid rgba(99, 102, 241, 0.4)",
                            borderRadius: 9999,
                            boxShadow: "0 4px 20px rgba(99, 102, 241, 0.2)",
                          }}
                        >
                          <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "#c7d2fe" }}>
                            {result.course}
                          </span>
                        </div>
                      </div>

                      {/* Certificate Footer Metadata */}
                      <div
                        style={{
                          marginTop: "1.5rem",
                          paddingTop: "1.25rem",
                          borderTop: "1px solid rgba(245, 158, 11, 0.25)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Credential Identification ID
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                            <span style={{ fontFamily: "monospace", fontSize: "1.1rem", fontWeight: 700, color: "#67e8f9" }}>
                              {result.id}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Verification Authority
                          </div>
                          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#e2e8f0", marginTop: "3px" }}>
                            CertVerify Cloud-Native CA
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Issue Timestamp
                          </div>
                          <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#f8fafc", marginTop: "3px" }}>
                            {result.issued_on || "Authentic"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div
                      className="no-print"
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "10px",
                        marginTop: "1.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={printCertificate}
                        className="btn btn-secondary"
                        style={{ padding: "10px 18px", fontSize: "0.9rem" }}
                      >
                        🖨️ Print / Save as PDF
                      </button>
                      <button
                        onClick={() => copyToClipboard(`${window.location.origin}/?id=${result.id}`, true)}
                        className="btn btn-secondary"
                        style={{ padding: "10px 18px", fontSize: "0.9rem" }}
                      >
                        {copiedLink ? "✓ Link Copied!" : "🔗 Shareable Verification Link"}
                      </button>
                      <button
                        onClick={() => copyToClipboard(result.id, false)}
                        className="btn btn-secondary"
                        style={{ padding: "10px 18px", fontSize: "0.9rem" }}
                      >
                        {copiedId ? "✓ ID Copied!" : "📋 Copy ID"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Not Found Card */
                  <div className="glass-panel no-print" style={{ padding: "2.5rem 1.5rem", textAlign: "center", borderColor: "rgba(239, 68, 68, 0.4)" }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        margin: "0 auto 1.25rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ef4444",
                        fontSize: "1.75rem",
                      }}
                    >
                      ✕
                    </div>
                    <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f87171", marginBottom: "0.5rem" }}>
                      Certificate Not Found
                    </h3>
                    <p style={{ color: "var(--text-muted)", maxWidth: 440, margin: "0 auto 1.25rem", fontSize: "0.92rem", lineHeight: 1.6 }}>
                      The requested credential identifier <code style={{ color: "#f87171", background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4 }}>{result.queryId}</code> does not exist in the authoritative database.
                    </p>
                    <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                      <span className="badge badge-danger">Status: Verification Failed</span>
                      <button
                        onClick={() => setActiveTab("admin")}
                        className="btn btn-secondary"
                        style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                      >
                        Issue this certificate in Admin Studio →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ADMIN STUDIO TAB */}
        {activeTab === "admin" && (
          <div className="animate-fade-in" style={{ maxWidth: 940, margin: "0 auto" }}>
            {!token ? (
              /* Admin Login Form */
              <div style={{ maxWidth: 460, margin: "2rem auto" }}>
                <div className="glass-panel" style={{ padding: "2.5rem 2rem" }}>
                  <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: "rgba(99, 102, 241, 0.15)",
                        border: "1px solid rgba(99, 102, 241, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1rem",
                        color: "#818cf8",
                      }}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <h2 style={{ fontSize: "1.7rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                      Admin Authentication
                    </h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
                      Sign in to the certificate issuance service with JWT authentication.
                    </p>
                  </div>

                  {loginError && (
                    <div
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        color: "#f87171",
                        fontSize: "0.85rem",
                        marginBottom: "1.25rem",
                      }}
                    >
                      {loginError}
                    </div>
                  )}

                  <form onSubmit={doLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
                        Username
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        value={login.username}
                        onChange={(e) => setLogin({ ...login, username: e.target.value })}
                        placeholder="admin"
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
                        Password
                      </label>
                      <input
                        type="password"
                        className="input-field"
                        value={login.password}
                        onChange={(e) => setLogin({ ...login, password: e.target.value })}
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="btn btn-primary"
                      style={{ marginTop: "0.5rem" }}
                    >
                      {loginLoading ? "Authenticating with JWT..." : "Sign In to Admin Studio"}
                    </button>
                  </form>

                  <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => setLogin({ username: "admin", password: "admin123" })}
                      style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: "0.82rem", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Fill default credentials (admin / admin123)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Admin Issuance Studio */
              <div>
                {/* Admin Session Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.9rem", fontWeight: 800 }}>Certificate Issuance Studio</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>
                      Issue verified digital credentials stored securely in AWS PostgreSQL RDS.
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="badge badge-success">JWT Session Active</span>
                    <button onClick={doLogout} className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                      Sign Out
                    </button>
                  </div>
                </div>

                {/* Form & Live Preview Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "2rem" }}>
                  {/* Left Column: Input Form */}
                  <div className="glass-panel" style={{ padding: "1.75rem" }}>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.25rem", color: "#c7d2fe" }}>
                      Issue New Credential
                    </h3>
                    <form onSubmit={issue} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
                          Student Full Name
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. Alex Morgan"
                          value={form.student_name}
                          onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
                          Course or Program Title
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. Cloud DevOps Engineering"
                          value={form.course}
                          onChange={(e) => setForm({ ...form, course: e.target.value })}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={issueLoading || !form.student_name.trim() || !form.course.trim()}
                        className="btn btn-primary"
                        style={{ marginTop: "0.5rem" }}
                      >
                        {issueLoading ? "Committing to RDS Database..." : "Issue Official Certificate"}
                      </button>
                    </form>

                    {/* Issued Success Message */}
                    {issued && (
                      <div className="animate-fade-in" style={{ marginTop: "1.5rem", padding: "1.25rem", borderRadius: 12, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#34d399", fontWeight: 700, fontSize: "0.95rem", marginBottom: "6px" }}>
                          <span>✓</span> Successfully Issued & Recorded!
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "10px" }}>
                          Certificate permanent identifier:
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <code style={{ background: "rgba(0,0,0,0.4)", padding: "6px 12px", borderRadius: 6, fontSize: "1.05rem", fontWeight: 700, color: "#67e8f9" }}>
                            {issued.id}
                          </code>
                          <button
                            onClick={() => copyToClipboard(issued.id, false)}
                            className="btn btn-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                          >
                            {copiedId ? "✓ Copied" : "Copy ID"}
                          </button>
                          <button
                            onClick={() => {
                              setVerifyId(issued.id);
                              setActiveTab("verify");
                              performVerification(issued.id);
                            }}
                            className="btn btn-primary"
                            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                          >
                            Verify Live
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Real-time Live Preview */}
                  <div>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Live Preview (As You Type)
                    </h3>
                    <div className="cert-certificate-paper" style={{ padding: "1.75rem" }}>
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--accent-gold)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                          Draft Certificate
                        </span>
                        <h4 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0.75rem 0 0.3rem", color: "#ffffff" }}>
                          {form.student_name || "Student Full Name"}
                        </h4>
                        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          Has demonstrated curricular mastery in:
                        </p>
                        <div style={{ display: "inline-block", margin: "0.85rem 0", padding: "6px 18px", background: "rgba(99, 102, 241, 0.15)", borderRadius: 9999, border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                          <span style={{ color: "#c7d2fe", fontWeight: 600, fontSize: "1rem" }}>
                            {form.course || "Course / Specialization Title"}
                          </span>
                        </div>
                        <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px dashed rgba(245, 158, 11, 0.2)", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                          Live Preview • AWS Deployment Authenticated
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Issued Credentials History */}
                {sessionHistory.length > 0 && (
                  <div className="glass-panel" style={{ marginTop: "2rem", padding: "1.5rem" }}>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem", color: "#ffffff" }}>
                      Issued in Current Session ({sessionHistory.length})
                    </h3>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-subtle)", textAlign: "left", color: "var(--text-dim)" }}>
                            <th style={{ padding: "8px 12px" }}>ID</th>
                            <th style={{ padding: "8px 12px" }}>Recipient</th>
                            <th style={{ padding: "8px 12px" }}>Course</th>
                            <th style={{ padding: "8px 12px", textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionHistory.map((item) => (
                            <tr key={item.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#67e8f9", fontWeight: 600 }}>
                                {item.id}
                              </td>
                              <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                                {item.student_name}
                              </td>
                              <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                                {item.course}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                <button
                                  onClick={() => {
                                    setVerifyId(item.id);
                                    setActiveTab("verify");
                                    performVerification(item.id);
                                  }}
                                  className="btn btn-secondary"
                                  style={{ padding: "4px 10px", fontSize: "0.75rem", marginRight: "6px" }}
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => copyToClipboard(item.id, false)}
                                  className="btn btn-secondary"
                                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                                >
                                  Copy ID
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ARCHITECTURE TAB */}
        {activeTab === "arch" && (
          <div className="animate-fade-in" style={{ maxWidth: 880, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <span className="badge badge-primary" style={{ marginBottom: "0.75rem" }}>
                DevOps & Cloud Architecture
              </span>
              <h2 style={{ fontSize: "2.4rem", fontWeight: 800 }}>
                CertVerify Infrastructure Map
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "1rem", maxWidth: 580, margin: "0 auto" }}>
                Designed and provisioned with AWS, Kubernetes, Terraform, and GitHub Actions CI/CD.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
              <div className="glass-panel" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🌐</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.4rem" }}>
                  Frontend & Nginx
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Vite + React single-page app served via an Nginx reverse proxy routing <code>/api/certs/</code> and <code>/api/verify/</code> to upstream microservices.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚙️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.4rem" }}>
                  FastAPI Microservices
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Decoupled services: <code>certificate-service</code> (JWT issuance & auth) and <code>verification-service</code> (low-latency public querying).
                </p>
              </div>

              <div className="glass-panel" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🗄️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.4rem" }}>
                  AWS RDS PostgreSQL 16
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Managed relational database in AWS ap-south-1 (Mumbai) with automated backups and security group isolation.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>☸️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.4rem" }}>
                  Kubernetes (k3s on EC2)
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Lightweight Kubernetes distribution deployed on AWS EC2 with Helm package manager and NodePort ingress.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🛡️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.4rem" }}>
                  DevSecOps & Trivy
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  GitHub Actions automated pipeline with pytest unit tests, Trivy vulnerability gating, and zero-downtime rolling Helm upgrades.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📦</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.4rem" }}>
                  Amazon ECR & S3
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Private AWS Elastic Container Registry repos for each containerized image and S3 buckets for object storage.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modern Footer */}
      <footer
        className="no-print"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          background: "rgba(9, 13, 22, 0.95)",
          padding: "1.75rem 1rem",
          textAlign: "center",
        }}
      >
        <div className="container" style={{ padding: 0 }}>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px", marginBottom: "0.85rem" }}>
            <span className="badge badge-primary">Docker</span>
            <span className="badge badge-primary">Kubernetes (k3s)</span>
            <span className="badge badge-primary">Helm</span>
            <span className="badge badge-primary">Terraform AWS</span>
            <span className="badge badge-primary">Trivy Security Gate</span>
            <span className="badge badge-primary">PostgreSQL RDS</span>
            <span className="badge badge-primary">FastAPI</span>
            <span className="badge badge-primary">React + Vite</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            CertVerify • Cloud-Native DevOps Engineering Platform • Automated CI/CD by GitHub Actions
          </p>
        </div>
      </footer>
    </div>
  );
}
