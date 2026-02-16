import Link from 'next/link';

export default function Home() {
  return (
    <>
      <nav className="navbar">
        <div className="container">
          <Link href="/" className="navbar-brand">Find<span>Any</span>Mail</Link>
          <div className="navbar-links">
            <Link href="/login">Login</Link>
            <Link href="/docs" style={{ marginRight: 15, color: 'var(--text-dim)' }}>API</Link>
            <Link href="/login" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-badge">✦ 100% Free &amp; Open Source</div>
            <h1>Find any email address in seconds</h1>
            <p>
              7-layer verification pipeline. SMTP verification, website scraping,
              AI analysis, and more. No credit card, no limits.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="btn btn-primary">Start Finding Emails →</Link>
              <a href="#how" className="btn btn-secondary">How It Works</a>
            </div>
          </div>
        </section>

        <section className="features">
          <div className="container">
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">🔍</div>
                <h3>SMTP Verification</h3>
                <p>Directly verifies if an email exists on the mail server without sending any email.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🌐</div>
                <h3>Website Scraping</h3>
                <p>Crawls company websites to detect email patterns from team pages and contact info.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🤖</div>
                <h3>AI Analysis</h3>
                <p>Optional GPT-4o-mini integration for intelligent pattern analysis on tricky domains.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h3>Bulk Processing</h3>
                <p>Upload a CSV with hundreds of names. Get back verified emails with confidence scores.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🏢</div>
                <h3>Company → Domain</h3>
                <p>Just type the company name — we resolve the domain automatically via Clearbit.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Single Connection</h3>
                <p>All patterns verified in one SMTP session. Full results in 1-2 seconds per lookup.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="how-it-works" id="how">
          <div className="container">
            <h2>How It Works</h2>
            <div className="steps">
              <div className="step">
                <div className="step-number">1</div>
                <h3>Enter Details</h3>
                <p>Name, surname, and company domain or name</p>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <h3>Intelligence</h3>
                <p>We analyze the domain, scrape the website, detect patterns</p>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <h3>Verification</h3>
                <p>SMTP verification, Gravatar checks, AI analysis</p>
              </div>
              <div className="step">
                <div className="step-number">4</div>
                <h3>Results</h3>
                <p>Scored and ranked emails with confidence levels</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          FindAnyMail — Free email finder. Self-hosted, open source.
        </div>
      </footer>
    </>
  );
}
