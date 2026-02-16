'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';

export default function DashboardPage() {
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState('finder');
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [error, setError] = useState('');

    // ── Finder State ─────────────────────
    const [finderMode, setFinderMode] = useState('single');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [domainOrCompany, setDomainOrCompany] = useState('');
    const [results, setResults] = useState(null);
    const [csvText, setCsvText] = useState('');
    const [bulkResults, setBulkResults] = useState(null);

    // ── Verify State ─────────────────────
    const [verifyEmail, setVerifyEmail] = useState('');
    const [verifyResult, setVerifyResult] = useState(null);
    const [verifyBulk, setVerifyBulk] = useState('');
    const [verifyBulkResults, setVerifyBulkResults] = useState(null);

    // ── Domain Search State ──────────────
    const [searchDomain, setSearchDomain] = useState('');
    const [domainResults, setDomainResults] = useState(null);

    // ── History State ────────────────────
    const [history, setHistory] = useState(null);
    const [historyPage, setHistoryPage] = useState(1);

    // ── Handlers ─────────────────────────

    const handleSingleSearch = async (e) => {
        e.preventDefault();
        if (!firstName || !lastName || !domainOrCompany) return;
        setLoading(true); setResults(null); setError('');
        try {
            const res = await fetch('/api/find-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName, domainOrCompany }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Failed.');
            else setResults(data);
        } catch { setError('Network error.'); }
        setLoading(false);
    };

    const handleBulkSearch = async () => {
        if (!csvText.trim()) return;
        setLoading(true); setBulkResults(null); setError('');
        try {
            const res = await fetch('/api/find-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bulk: true, csv: csvText }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Failed.');
            else setBulkResults(data);
        } catch { setError('Network error.'); }
        setLoading(false);
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!verifyEmail) return;
        setLoading(true); setVerifyResult(null); setError('');
        try {
            const res = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: verifyEmail }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Failed.');
            else setVerifyResult(data);
        } catch { setError('Network error.'); }
        setLoading(false);
    };

    const handleBulkVerify = async () => {
        if (!verifyBulk.trim()) return;
        setLoading(true); setVerifyBulkResults(null); setError('');
        const emails = verifyBulk.split('\n').map(e => e.trim()).filter(e => e.includes('@'));
        try {
            const res = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Failed.');
            else setVerifyBulkResults(data);
        } catch { setError('Network error.'); }
        setLoading(false);
    };

    const handleDomainSearch = async (e) => {
        e.preventDefault();
        if (!searchDomain) return;
        setLoading(true); setDomainResults(null); setError('');
        try {
            const res = await fetch('/api/domain-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: searchDomain }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Failed.');
            else setDomainResults(data);
        } catch { setError('Network error.'); }
        setLoading(false);
    };

    const loadHistory = useCallback(async (page = 1) => {
        try {
            const res = await fetch(`/api/history?page=${page}&limit=25`);
            const data = await res.json();
            setHistory(data);
            setHistoryPage(page);
        } catch { }
    }, []);

    const clearAllHistory = async () => {
        if (!confirm('Clear all search history?')) return;
        await fetch('/api/history', { method: 'DELETE' });
        loadHistory(1);
    };

    useEffect(() => {
        if (activeTab === 'history') loadHistory(historyPage);
    }, [activeTab, historyPage, loadHistory]);

    const downloadCSV = (data, filename) => {
        const blob = new Blob([data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    const downloadFinderCSV = () => {
        if (!bulkResults?.results) return;
        const header = 'first_name,last_name,domain,email,confidence,score,method\n';
        const rows = bulkResults.results.map(r =>
            `${r.firstName},${r.lastName},${r.domainOrCompany || ''},${r.email},${r.confidence},${r.score},${r.method}`
        ).join('\n');
        downloadCSV(header + rows, `findanymail-results-${Date.now()}.csv`);
    };

    const downloadVerifyCSV = () => {
        if (!verifyBulkResults?.results) return;
        const header = 'email,status,reason,provider,catch_all,gravatar\n';
        const rows = verifyBulkResults.results.map(r =>
            `${r.email},${r.status},${r.reason},${r.details?.provider || ''},${r.details?.isCatchAll || ''},${r.details?.hasGravatar || ''}`
        ).join('\n');
        downloadCSV(header + rows, `verify-results-${Date.now()}.csv`);
    };

    const copyEmail = (email, el) => {
        navigator.clipboard.writeText(email);
        el.textContent = 'Copied!';
        el.classList.add('copied');
        setTimeout(() => { el.textContent = 'Copy'; el.classList.remove('copied'); }, 1500);
    };

    return (
        <>
            <nav className="navbar">
                <div className="container">
                    <Link href="/" className="navbar-brand">Find<span>Any</span>Mail</Link>
                    <div className="navbar-links">
                        <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{session?.user?.name}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => signOut()}>Sign Out</button>
                    </div>
                </div>
            </nav>

            <main className="dashboard">
                <div className="container">
                    <div className="dashboard-header">
                        <h1>Dashboard</h1>
                        <p>Find, verify, and search email addresses.</p>
                    </div>

                    <div className="tabs">
                        {['finder', 'verify', 'domain', 'history'].map(tab => (
                            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => { setActiveTab(tab); setError(''); }}>
                                {tab === 'finder' && '🔍 Email Finder'}
                                {tab === 'verify' && '✓ Verify'}
                                {tab === 'domain' && '🏢 Domain Search'}
                                {tab === 'history' && '🕐 History'}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div className="warning-bar" style={{ background: 'var(--red-muted)', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)' }}>
                            ✕ {error}
                        </div>
                    )}

                    {loading && (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <div className="loading-text">Processing...</div>
                        </div>
                    )}

                    {/* ═══ EMAIL FINDER TAB ═══ */}
                    {activeTab === 'finder' && !loading && (
                        <>
                            <div className="sub-tabs">
                                <button className={`sub-tab ${finderMode === 'single' ? 'active' : ''}`}
                                    onClick={() => setFinderMode('single')}>Single</button>
                                <button className={`sub-tab ${finderMode === 'bulk' ? 'active' : ''}`}
                                    onClick={() => setFinderMode('bulk')}>Bulk CSV</button>
                            </div>

                            {finderMode === 'single' && (
                                <form onSubmit={handleSingleSearch}>
                                    <div className="search-grid">
                                        <div className="form-group">
                                            <label className="form-label">First Name</label>
                                            <input className="input" value={firstName}
                                                onChange={e => setFirstName(e.target.value)} placeholder="John" required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Last Name</label>
                                            <input className="input" value={lastName}
                                                onChange={e => setLastName(e.target.value)} placeholder="Doe" required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Domain or Company</label>
                                            <input className="input" value={domainOrCompany}
                                                onChange={e => setDomainOrCompany(e.target.value)} placeholder="company.com" required />
                                        </div>
                                        <button className="btn btn-primary" type="submit">Search</button>
                                    </div>
                                </form>
                            )}

                            {finderMode === 'bulk' && (
                                <div>
                                    <p className="bulk-info">
                                        Paste CSV with columns: <code>first_name, last_name, domain</code> (or company name). Max 500 rows.
                                    </p>
                                    <textarea className="input textarea" value={csvText}
                                        onChange={e => setCsvText(e.target.value)}
                                        placeholder={`first_name,last_name,domain\nJohn,Doe,company.com\nJane,Smith,another.co`}
                                        rows={8} />
                                    <div className="bulk-actions">
                                        <button className="btn btn-primary" onClick={handleBulkSearch}>Process CSV</button>
                                        {bulkResults && <button className="btn btn-secondary" onClick={downloadFinderCSV}>Download CSV</button>}
                                    </div>
                                </div>
                            )}

                            {/* Single Results */}
                            {results && <SingleResults data={results} onCopy={copyEmail} />}

                            {/* Bulk Results */}
                            {bulkResults && (
                                <div className="results-section">
                                    <div className="results-header">
                                        <h2>Bulk Results — {bulkResults.total} entries</h2>
                                        <button className="btn btn-secondary btn-sm" onClick={downloadFinderCSV}>Download CSV</button>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="results-table">
                                            <thead><tr><th>Name</th><th>Domain</th><th>Email</th><th>Confidence</th><th>Score</th></tr></thead>
                                            <tbody>
                                                {bulkResults.results?.map((r, i) => (
                                                    <tr key={i}>
                                                        <td>{r.firstName} {r.lastName}</td>
                                                        <td>{r.domainOrCompany}</td>
                                                        <td className="td-email">{r.email || '—'}</td>
                                                        <td>{r.confidence && r.confidence !== 'none' ? <span className={`badge badge-${r.confidence}`}>{r.confidence}</span> : '—'}</td>
                                                        <td>{r.score || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══ VERIFY TAB ═══ */}
                    {activeTab === 'verify' && !loading && (
                        <>
                            <div className="sub-tabs">
                                <button className={`sub-tab ${!verifyBulkResults ? 'active' : ''}`}
                                    onClick={() => setVerifyBulkResults(null)}>Single</button>
                                <button className="sub-tab" onClick={() => setVerifyResult(null)}>Bulk</button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                <div>
                                    <h3 style={{ fontSize: 15, marginBottom: 12 }}>Verify an Email</h3>
                                    <form onSubmit={handleVerify}>
                                        <div className="form-group" style={{ marginBottom: 12 }}>
                                            <input className="input" value={verifyEmail}
                                                onChange={e => setVerifyEmail(e.target.value)}
                                                placeholder="john@company.com" type="email" required />
                                        </div>
                                        <button className="btn btn-primary" type="submit">Verify</button>
                                    </form>

                                    {verifyResult && (
                                        <div className="card" style={{ marginTop: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <span style={{ fontSize: 20 }}>
                                                    {verifyResult.status === 'valid' ? '✅' : verifyResult.status === 'invalid' ? '❌' : verifyResult.status === 'risky' ? '⚠️' : '❓'}
                                                </span>
                                                <span className={`badge badge-${verifyResult.status === 'valid' ? 'verified' : verifyResult.status === 'invalid' ? 'error' : 'likely'}`}>
                                                    {verifyResult.status}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>{verifyResult.reason}</p>
                                            <div className="meta-bar" style={{ padding: '10px 14px' }}>
                                                <div className="meta-item">
                                                    <span className="meta-label">Provider</span>
                                                    <span className="meta-value">{verifyResult.details?.provider || '—'}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">Catch-All</span>
                                                    <span className="meta-value">{verifyResult.details?.isCatchAll ? 'Yes' : 'No'}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">Gravatar</span>
                                                    <span className="meta-value">{verifyResult.details?.hasGravatar ? 'Yes' : 'No'}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">Role-Based</span>
                                                    <span className="meta-value">{verifyResult.details?.isRoleBased ? 'Yes' : 'No'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h3 style={{ fontSize: 15, marginBottom: 12 }}>Bulk Verify</h3>
                                    <textarea className="input textarea" value={verifyBulk}
                                        onChange={e => setVerifyBulk(e.target.value)}
                                        placeholder={`john@company.com\njane@example.com\n...`} rows={5} />
                                    <div className="bulk-actions">
                                        <button className="btn btn-primary" onClick={handleBulkVerify}>Verify All</button>
                                        {verifyBulkResults && <button className="btn btn-secondary" onClick={downloadVerifyCSV}>Download CSV</button>}
                                    </div>
                                    {verifyBulkResults && (
                                        <div style={{ marginTop: 16, overflowX: 'auto' }}>
                                            <table className="results-table">
                                                <thead><tr><th>Email</th><th>Status</th><th>Provider</th></tr></thead>
                                                <tbody>
                                                    {verifyBulkResults.results?.map((r, i) => (
                                                        <tr key={i}>
                                                            <td className="td-email">{r.email}</td>
                                                            <td><span className={`badge badge-${r.status === 'valid' ? 'verified' : r.status === 'invalid' ? 'error' : 'likely'}`}>{r.status}</span></td>
                                                            <td>{r.details?.provider || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══ DOMAIN SEARCH TAB ═══ */}
                    {activeTab === 'domain' && !loading && (
                        <>
                            <form onSubmit={handleDomainSearch} style={{ marginBottom: 24 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                                    <div className="form-group">
                                        <label className="form-label">Domain</label>
                                        <input className="input" value={searchDomain}
                                            onChange={e => setSearchDomain(e.target.value)}
                                            placeholder="company.com" required />
                                    </div>
                                    <button className="btn btn-primary" style={{ height: 42 }} type="submit">Search Domain</button>
                                </div>
                            </form>

                            {domainResults && (
                                <div>
                                    <div className="meta-bar" style={{ marginBottom: 16 }}>
                                        <div className="meta-item">
                                            <span className="meta-label">Domain</span>
                                            <span className="meta-value">{domainResults.domain}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Provider</span>
                                            <span className="meta-value">{domainResults.provider}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Pattern</span>
                                            <span className="meta-value">{domainResults.detectedPattern || '—'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Emails Found</span>
                                            <span className="meta-value">{domainResults.emailsFound}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Catch-All</span>
                                            <span className="meta-value">{domainResults.isCatchAll ? 'Yes' : 'No'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Duration</span>
                                            <span className="meta-value">{domainResults.duration}ms</span>
                                        </div>
                                    </div>

                                    {domainResults.error && (
                                        <div className="warning-bar" style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>{domainResults.error}</div>
                                    )}

                                    {domainResults.emails?.length > 0 ? (
                                        <div className="result-list">
                                            {domainResults.emails.map((r, i) => (
                                                <div key={i} className="result-row">
                                                    <span className="result-email">{r.email}</span>
                                                    <div className="result-info">
                                                        <span className={`badge badge-${r.verified ? 'verified' : r.smtpStatus === 'invalid' ? 'error' : 'possible'}`}>
                                                            {r.verified ? 'verified' : r.smtpStatus || 'found'}
                                                        </span>
                                                        <button className="copy-btn" onClick={e => copyEmail(r.email, e.target)}>Copy</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
                                            No emails found on this domain.
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══ HISTORY TAB ═══ */}
                    {activeTab === 'history' && !loading && (
                        <>
                            <div className="results-header" style={{ marginBottom: 16 }}>
                                <h2 style={{ fontSize: 16 }}>
                                    Search History {history && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({history.total} total)</span>}
                                </h2>
                                {history?.total > 0 && (
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={clearAllHistory}>
                                        Clear All
                                    </button>
                                )}
                            </div>

                            {history?.entries?.length > 0 ? (
                                <>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="results-table">
                                            <thead>
                                                <tr>
                                                    <th>Time</th>
                                                    <th>Name</th>
                                                    <th>Domain</th>
                                                    <th>Best Email</th>
                                                    <th>Confidence</th>
                                                    <th>Provider</th>
                                                    <th>Duration</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.entries.map((h, i) => (
                                                    <tr key={i}>
                                                        <td style={{ whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-dim)' }}>
                                                            {new Date(h.timestamp).toLocaleString()}
                                                        </td>
                                                        <td>{h.firstName} {h.lastName}</td>
                                                        <td>{h.domain || h.domainOrCompany}</td>
                                                        <td className="td-email">{h.bestEmail || '—'}</td>
                                                        <td>
                                                            {h.confidence ? <span className={`badge badge-${h.confidence}`}>{h.confidence}</span> : '—'}
                                                        </td>
                                                        <td>{h.provider || '—'}</td>
                                                        <td style={{ fontSize: 13, color: 'var(--text-dim)' }}>{h.duration}ms</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {history.totalPages > 1 && (
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                                            <button className="btn btn-secondary btn-sm" disabled={historyPage <= 1}
                                                onClick={() => setHistoryPage(p => p - 1)}>← Prev</button>
                                            <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
                                                Page {history.page} of {history.totalPages}
                                            </span>
                                            <button className="btn btn-secondary btn-sm" disabled={historyPage >= history.totalPages}
                                                onClick={() => setHistoryPage(p => p + 1)}>Next →</button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)' }}>
                                    No searches yet. Results from the Email Finder will appear here.
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </>
    );
}

// ── Single Results Component ─────────────
function SingleResults({ data, onCopy }) {
    return (
        <div className="results-section">
            <div className="results-header">
                <h2>Results</h2>
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{data.meta?.duration}ms</span>
            </div>

            {data.meta?.warnings?.map((w, i) => (
                <div key={i} className="warning-bar">⚠ {w}</div>
            ))}

            {data.meta && (
                <div className="meta-bar">
                    <div className="meta-item">
                        <span className="meta-label">Domain</span>
                        <span className="meta-value">{data.meta.domain}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Provider</span>
                        <span className="meta-value">{data.meta.provider}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Pattern</span>
                        <span className="meta-value">{data.meta.detectedPattern || '—'}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">SMTP</span>
                        <span className="meta-value" style={{ color: data.meta.smtpAvailable ? 'var(--green)' : 'var(--text-dim)' }}>
                            {data.meta.smtpAvailable ? `${data.meta.smtpVerified} verified` : 'unavailable'}
                        </span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Site Emails</span>
                        <span className="meta-value">{data.meta.websiteEmailsFound || 0}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Gravatar</span>
                        <span className="meta-value">{data.meta.gravatarHits || 0} hits</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">DISIFY</span>
                        <span className="meta-value">{data.meta.disifyChecked || 0} checked</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">Catch-All</span>
                        <span className="meta-value">{data.meta.isCatchAll ? 'Yes' : 'No'}</span>
                    </div>
                    {data.meta.company && (
                        <div className="meta-item">
                            <span className="meta-label">Company</span>
                            <span className="meta-value">{data.meta.company}</span>
                        </div>
                    )}
                </div>
            )}

            {data.meta?.error && (
                <div className="warning-bar" style={{ background: 'var(--red-muted)', color: 'var(--red)' }}>{data.meta.error}</div>
            )}

            <div className="result-list">
                {data.results?.length === 0 && !data.meta?.error && (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>No valid emails found.</div>
                )}
                {data.results?.map((r, i) => (
                    <div key={i} className="result-row">
                        <div>
                            <div className="result-email">{r.email}</div>
                            <div className="signals" style={{ marginTop: 6 }}>
                                {r.signals?.map((s, j) => <span key={j} className="signal-tag">{s.replace(/_/g, ' ')}</span>)}
                            </div>
                        </div>
                        <div className="result-info">
                            <span className="result-score">{r.score}/100</span>
                            <span className={`badge badge-${r.confidence}`}>{r.confidence}</span>
                            <button className="copy-btn" onClick={e => onCopy(r.email, e.target)}>Copy</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
