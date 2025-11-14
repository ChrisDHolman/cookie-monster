# Web Compliance Scanner

A comprehensive CLI tool for scanning websites to detect GDPR, CCPA, and ePrivacy Directive compliance issues related to cookies, tracking scripts, and consent mechanisms.

> **✅ Latest Update**: Fixed critical bug in compliance checking that was incorrectly flagging necessary cookies (consent management, security) as violations. The scanner now uses smart categorization to only flag actual violations.

## Features

- 🕷️ **Full Site Crawling**: Automatically discovers and scans all pages on a domain
- 🍪 **Advanced Cookie Analysis**: Identifies first-party and third-party cookies with 90+ vendor patterns
  - Cookie syncing/data sharing detection
  - Unnecessary/excessive cookie identification
  - Risk level scoring with detailed reasons
- 📜 **Script Analysis**: Detects tracking scripts, analytics, advertising, and social media widgets
- ✅ **Consent Testing**: Tests cookie consent mechanisms (Accept All, Reject All scenarios)
  - Supports 6 consent vendors: OneTrust, Cookiebot, Cookie Consent, Osano, Termly, TrustArc
- ⚖️ **Multi-Framework Compliance**: Checks against GDPR, CCPA, and ePrivacy Directive
  - Smart categorization: only flags actual violations (analytics, advertising, social cookies)
  - Correctly excludes necessary cookies (consent management, security)
- 🤖 **AI-Powered Summaries**: Optional Claude-powered compliance report generation
- 📊 **Detailed Reporting**: Terminal summary + comprehensive HTML + JSON reports
- ✅ **Comprehensive Test Suite**: 117 tests with Jest and TypeScript

## Installation

```bash
# Clone the repository
git clone https://github.com/ChrisDHolman/cookie-monster.git
cd cookie-monster

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Build the project
npm run build
```

## Usage

### Basic Scan

```bash
npm run scan -- scan https://example.com
```

### Advanced Options

```bash
# Scan with custom depth
npm run scan -- scan https://example.com --depth 5

# Custom output directory
npm run scan -- scan https://example.com --output ./my-reports

# Run in headed mode (visible browser)
npm run scan -- scan https://example.com --no-headless

# Custom delay between requests (in ms)
npm run scan -- scan https://example.com --delay 2000

# Specify frameworks to check
npm run scan -- scan https://example.com --frameworks gdpr,ccpa
```

### Example Command

```bash
npm run scan -- scan https://example.com --depth 3 --delay 1500 --output ./reports
```

## Output

The scanner generates three types of reports:

### 1. Terminal Output

A concise summary displayed in your terminal with:
- Overall compliance score
- Framework-specific scores (GDPR, CCPA, ePrivacy)
- Summary statistics
- Critical issues and warnings
- Positive findings
- AI-powered compliance assessment (if API key configured)

### 2. HTML Report

A detailed HTML report saved to the output directory containing:
- Executive summary with scores
- Detailed statistics
- Complete list of issues with severity levels
- Affected items for each issue
- Actionable recommendations
- Cookie analysis tables
- Positive findings

Reports are saved as: `compliance-report-[domain]-[date].html`

### 3. JSON Report

A machine-readable JSON report containing:
- Complete scan results and raw data
- All cookie and script detections
- Consent test results (before/after accept/after reject)
- Cookie analysis with vendor detection and risk scoring
- All compliance violations with affected items

Reports are saved as: `compliance-report-[domain]-[date].json`

## What It Scans For

### Cookies
- First-party vs third-party cookies
- Cookies set before consent
- Cookie expiration times
- HttpOnly and Secure flags

### Scripts & Trackers (90+ Vendor Patterns)
**Analytics**: Google Analytics (GA4, Universal, Legacy), Microsoft Clarity, Hotjar, Mixpanel, Segment, Heap, HubSpot

**Advertising**: Google Ads, DoubleClick, Facebook/Meta Pixel, Taboola, Outbrain, Criteo, AddThis, MediaMath

**Social Media**: LinkedIn, Twitter/X, Pinterest, TikTok, Facebook

**Marketing Automation**: HubSpot, Marketo, Salesforce Marketing Cloud, Pardot, Vimeo

**E-commerce**: Shopify

**Performance**: Cloudflare (security/functional)

**A/B Testing**: Optimizely, VWO

### Consent Mechanisms
- Presence of cookie consent UI
- "Accept All" functionality
- "Reject All" functionality
- Consent vendor detection: **OneTrust, Cookiebot, Cookie Consent, Osano, Termly, TrustArc**

### Compliance Checks

#### GDPR
- Non-essential cookies before consent
- Tracking scripts before consent
- Consent mechanism presence
- Equal prominence of accept/reject options
- Third-party cookie usage

#### CCPA
- Data selling indicators
- Third-party disclosure
- Opt-out mechanisms
- Cross-device tracking

#### ePrivacy Directive
- Cookie consent requirements
- Tracking technology consent
- Strictly necessary cookie classification
- Consent withdrawal mechanisms

## Project Structure

```
web-compliance-scanner/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── spider/               # Web crawling logic
│   ├── scanner/              # Cookie & script detection
│   ├── compliance/           # Compliance rule checking
│   ├── reporter/             # Report generation
│   └── utils/                # Utility functions
├── reports/                  # Generated reports
└── logs/                     # Application logs
```

## Development

```bash
# Run in development mode
npm run dev -- scan https://example.com

# Build for production
npm run build

# Run all tests (117 tests)
npm test

# Run specific test file
npm test -- tests/scanner/cookieAnalyzer.test.ts

# Run tests in watch mode
npm test -- --watch

# Lint code
npm run lint
```

## Testing

The project includes comprehensive test coverage:
- **urlQueue**: 32 tests covering URL normalization, queue management, and domain validation
- **cookieAnalyzer**: 68 tests covering vendor detection, risk scoring, cookie syncing detection
- **consentTester**: 17 tests covering all 6 supported consent vendors

Run tests with: `npm test`

## Configuration

### Crawl Depth
Controls how many levels deep the crawler will go from the starting URL. Default is 3.

### Delay
Milliseconds to wait between requests. Helps avoid rate limiting. Default is 1000ms (1 second).

### Frameworks
Comma-separated list of compliance frameworks to check:
- `gdpr` - General Data Protection Regulation
- `ccpa` - California Consumer Privacy Act
- `eprivacy` - ePrivacy Directive

Default checks all three frameworks.

### AI-Powered Summaries (Optional)
To enable AI-powered compliance summaries, set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

Without the API key, the scanner will use a fallback summary generator (no AI features).

## Limitations

- Only crawls pages on the same domain (subdomain must match)
- Cannot access password-protected pages
- May not detect all consent mechanisms (constantly evolving implementations)
- Scoring is heuristic-based and should be verified by legal counsel
- Does not check privacy policy content

## Troubleshooting

### Browser Installation Issues
```bash
npx playwright install chromium
```

### Rate Limiting
Increase the delay between requests:
```bash
npm run scan -- scan https://example.com --delay 2000
```

### TypeScript Errors
```bash
npm run build
```

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Disclaimer

This tool provides automated compliance scanning and should be used as a starting point for compliance audits. It does not constitute legal advice. Always consult with legal professionals for compliance matters.

## Roadmap

### ✅ Completed
- [x] Comprehensive test suite (117 tests with Jest)
- [x] Enhanced cookie vendor database (90+ patterns)
- [x] Cookie syncing/data sharing detection
- [x] Support for 6 consent vendors (OneTrust, Cookiebot, Cookie Consent, Osano, Termly, TrustArc)
- [x] Unnecessary/excessive cookie detection
- [x] AI-powered summary generation (Claude integration)
- [x] JSON report export

### 🚧 In Progress
- [ ] Dark pattern detection (3-4 patterns identified)
- [ ] Compliance rule engine tests

### 📋 Planned
- [ ] Privacy policy parsing and analysis
- [ ] Change tracking over time (database layer)
- [ ] API endpoint scanning
- [ ] PDF report generation
- [ ] CI/CD integration (GitHub Actions examples)
- [ ] Docker support

## Support

For issues, questions, or contributions, please open an issue on GitHub.
