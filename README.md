# Web Compliance Scanner

A comprehensive CLI tool for scanning websites to detect GDPR, CCPA, and ePrivacy Directive compliance issues related to cookies, tracking scripts, and consent mechanisms.

## Features

- 🕷️ **Full Site Crawling**: Automatically discovers and scans all pages on a domain
- 🍪 **Cookie Detection**: Identifies first-party and third-party cookies
- 📜 **Script Analysis**: Detects tracking scripts, analytics, advertising, and social media widgets
- ✅ **Consent Testing**: Tests cookie consent mechanisms (Accept All, Reject All scenarios)
- ⚖️ **Multi-Framework Compliance**: Checks against GDPR, CCPA, and ePrivacy Directive
- 📊 **Detailed Reporting**: Terminal summary + comprehensive HTML reports

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd web-compliance-scanner

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

The scanner generates two types of reports:

### 1. Terminal Output

A concise summary displayed in your terminal with:
- Overall compliance score
- Framework-specific scores (GDPR, CCPA, ePrivacy)
- Summary statistics
- Critical issues and warnings
- Positive findings

### 2. HTML Report

A detailed HTML report saved to the output directory containing:
- Executive summary with scores
- Detailed statistics
- Complete list of issues with severity levels
- Affected items for each issue
- Actionable recommendations
- Positive findings

Reports are saved as: `compliance-report-[domain]-[date].html`

## What It Scans For

### Cookies
- First-party vs third-party cookies
- Cookies set before consent
- Cookie expiration times
- HttpOnly and Secure flags

### Scripts & Trackers
- Google Analytics, Tag Manager
- Facebook Pixel
- Advertising networks (DoubleClick, AdSense)
- Marketing automation tools
- Social media widgets
- A/B testing tools

### Consent Mechanisms
- Presence of cookie consent UI
- "Accept All" functionality
- "Reject All" functionality
- Consent vendor detection (OneTrust, Cookiebot, etc.)

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

# Run tests (when implemented)
npm test

# Lint code
npm run lint
```

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

- [ ] Privacy policy parsing and analysis
- [ ] Dark pattern detection improvements
- [ ] Support for more consent vendors
- [ ] Change tracking over time
- [ ] API endpoint scanning
- [ ] PDF report generation
- [ ] CI/CD integration
- [ ] Docker support

## Support

For issues, questions, or contributions, please open an issue on GitHub.
