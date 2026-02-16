'use client';

export default function ApiDocs() {
    return (
        <div className="docs-container">
            <nav className="navbar">
                <div className="container">
                    <a href="/" className="navbar-brand">Find<span>Any</span>Mail</a>
                    <div className="navbar-links">
                        <a href="/dashboard">Dashboard</a>
                        <a href="/login" className="btn btn-primary btn-sm">Login</a>
                    </div>
                </div>
            </nav>

            <main className="docs-content">
                <h1>API Documentation</h1>
                <p className="lead">Integrate email verification into your own applications.</p>

                <section id="auth">
                    <h2>Authentication</h2>
                    <p>All API endpoints require an API key passed in the header.</p>
                    <div className="code-block">
                        <pre>x-api-key: YOUR_API_KEY</pre>
                    </div>
                </section>

                <section id="find-email">
                    <h2>Find & Verify Email</h2>
                    <span className="method post">POST</span> <span className="endpoint">/api/find-email</span>

                    <h3>Request Body</h3>
                    <div className="code-block">
                        <pre>{JSON.stringify({
                            "firstName": "John",
                            "lastName": "Doe",
                            "domainOrCompany": "google.com" // or "Google"
                        }, null, 2)}</pre>
                    </div>

                    <h3>Response</h3>
                    <div className="code-block">
                        <pre>{JSON.stringify({
                            "mode": "single",
                            "results": [
                                {
                                    "email": "john.doe@google.com",
                                    "score": 85,
                                    "confidence": "verified",
                                    "signals": ["smtp_verified", "gravatar_found"],
                                    "method": "smtp"
                                }
                            ],
                            "meta": {
                                "domain": "google.com",
                                "smtpAvailable": true
                            }
                        }, null, 2)}</pre>
                    </div>
                </section>

                <section id="verify">
                    <h2>Verify Single Email</h2>
                    <span className="method post">POST</span> <span className="endpoint">/api/verify</span>

                    <h3>Request Body</h3>
                    <div className="code-block">
                        <pre>{JSON.stringify({
                            "email": "john.doe@google.com"
                        }, null, 2)}</pre>
                    </div>

                    <h3>Response</h3>
                    <div className="code-block">
                        <pre>{JSON.stringify({
                            "email": "john.doe@google.com",
                            "status": "valid",
                            "score": 95,
                            "provider": "Google Workspace",
                            "mx": "smtp.google.com",
                            "gravatar": true,
                            "disify": { "format": true, "disposable": false, "dns": true }
                        }, null, 2)}</pre>
                    </div>
                </section>

                <section id="domain-search">
                    <h2>Domain Search</h2>
                    <span className="method post">POST</span> <span className="endpoint">/api/domain-search</span>

                    <h3>Request Body</h3>
                    <div className="code-block">
                        <pre>{JSON.stringify({
                            "domain": "stripe.com"
                        }, null, 2)}</pre>
                    </div>

                    <h3>Response</h3>
                    <div className="code-block">
                        <pre>{JSON.stringify({
                            "domain": "stripe.com",
                            "emails": [
                                { "email": "support@stripe.com", "source": "web_scrape" },
                                { "email": "press@stripe.com", "source": "web_scrape" }
                            ],
                            "pattern": "first.last"
                        }, null, 2)}</pre>
                    </div>
                </section>
            </main>

            <style jsx global>{`
        .docs-container {
          background-color: var(--bg-color);
          color: var(--text-color);
          min-height: 100vh;
        }
        .docs-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        h1 { margin-bottom: 10px; font-size: 2.5rem; }
        .lead { font-size: 1.2rem; color: var(--text-dim); margin-bottom: 40px; }
        h2 { margin-top: 60px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
        h3 { margin-top: 30px; margin-bottom: 10px; font-size: 1.1rem; color: var(--text-dim); }
        
        .code-block {
          background: #111;
          padding: 20px;
          border-radius: 8px;
          overflow-x: auto;
          border: 1px solid var(--border-color);
          font-family: 'Fira Code', monospace;
          font-size: 14px;
        }
        
        .method {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 0.9rem;
          margin-right: 10px;
        }
        .method.post { background: var(--green-dim); color: var(--green); }
        .endpoint { font-family: monospace; font-size: 1.1rem; }
      `}</style>
        </div>
    );
}
