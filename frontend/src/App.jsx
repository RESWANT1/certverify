import { useState } from "react";

export default function App() {
  const [token, setToken] = useState("");
  const [login, setLogin] = useState({ username: "admin", password: "" });
  const [form, setForm] = useState({ student_name: "", course: "" });
  const [issued, setIssued] = useState(null);
  const [verifyId, setVerifyId] = useState("");
  const [result, setResult] = useState(null);

  async function doLogin() {
    const res = await fetch("/api/certs/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(login),
    });
    if (res.ok) setToken((await res.json()).access_token);
    else alert("Login failed");
  }

  async function issue() {
    const res = await fetch("/api/certs/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setIssued(await res.json());
  }

  async function verify() {
    const res = await fetch(`/api/verify/${verifyId}`);
    setResult(res.ok ? await res.json() : { valid: false });
  }

  return (
    <div style={{ maxWidth: 520, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>CertVerify</h1>

      <h2>Verify a certificate</h2>
      <input placeholder="CERT-XXXXXXXX" value={verifyId} onChange={(e) => setVerifyId(e.target.value)} />
      <button onClick={verify}>Verify</button>
      {result && (
        <p>
          {result.valid
            ? `Valid: ${result.student_name}, ${result.course}, issued ${result.issued_on}`
            : "Certificate not found"}
        </p>
      )}

      <h2>Admin</h2>
      {!token ? (
        <>
          <input placeholder="username" value={login.username}
                 onChange={(e) => setLogin({ ...login, username: e.target.value })} />
          <input type="password" placeholder="password"
                 onChange={(e) => setLogin({ ...login, password: e.target.value })} />
          <button onClick={doLogin}>Login</button>
        </>
      ) : (
        <>
          <input placeholder="Student name"
                 onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
          <input placeholder="Course"
                 onChange={(e) => setForm({ ...form, course: e.target.value })} />
          <button onClick={issue}>Issue certificate</button>
          {issued && <p>Issued: <b>{issued.id}</b></p>}
        </>
      )}
    </div>
  );
}
