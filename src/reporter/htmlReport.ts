import fs from 'fs';
import path from 'path';
import { ComplianceResults } from '../compliance/types';
import { logger } from '../utils/logger';

export class HtmlReporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  /**
   * Generate HTML report
   */
  async generate(results: ComplianceResults, url: string): Promise<string> {
    const html = this.buildHtml(results);
    const filename = this.generateFilename(url);
    const filepath = path.join(this.outputDir, filename);

    fs.writeFileSync(filepath, html, 'utf-8');
    logger.info(`HTML report generated: ${filepath}`);

    // Also save JSON with detailed data
    const jsonPath = filepath.replace('.html', '.json');
    const detailedResults = {
      ...results,
      // Add the full scan results which contain all cookies and scripts
      fullScanData: results
    };
    fs.writeFileSync(jsonPath, JSON.stringify(detailedResults, null, 2), 'utf-8');

    return filepath;
  }

  /**
   * Build HTML content
   */
  private buildHtml(results: ComplianceResults): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Compliance Report - ${results.url}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; margin-bottom: 10px; font-size: 2em; }
        h2 { color: #34495e; margin: 30px 0 15px; font-size: 1.5em; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h3 { color: #555; margin: 20px 0 10px; font-size: 1.2em; }
        .header { margin-bottom: 30px; }
        .meta { color: #7f8c8d; font-size: 0.9em; margin-bottom: 20px; }
        .score-container {
            display: flex;
            gap: 20px;
            margin: 30px 0;
            flex-wrap: wrap;
        }
        .score-card {
            flex: 1;
            min-width: 200px;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .score-card.excellent { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .score-card.good { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; }
        .score-card.fair { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; }
        .score-card.poor { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; }
        .score-number { font-size: 3em; font-weight: bold; margin: 10px 0; }
        .score-label { font-size: 0.9em; opacity: 0.9; }
        .framework-scores {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .framework-card {
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #fafafa;
        }
        .framework-name { font-weight: bold; font-size: 1.1em; margin-bottom: 10px; }
        .framework-score { font-size: 2em; color: #3498db; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-item {
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #3498db;
            border-radius: 4px;
        }
        .stat-label { font-size: 0.85em; color: #666; }
        .stat-value { font-size: 1.5em; font-weight: bold; color: #2c3e50; margin-top: 5px; }
        .stat-value.warning { color: #e74c3c; }
        .issue {
            margin: 15px 0;
            padding: 15px;
            border-left: 4px solid #ccc;
            border-radius: 4px;
            background: #f9f9f9;
        }
        .issue.critical { border-left-color: #e74c3c; background: #fee; }
        .issue.warning { border-left-color: #f39c12; background: #fef9e7; }
        .issue.info { border-left-color: #3498db; background: #ebf5fb; }
        .issue-title { font-weight: bold; margin-bottom: 8px; font-size: 1.1em; }
        .issue-title.critical { color: #c0392b; }
        .issue-title.warning { color: #d68910; }
        .issue-title.info { color: #2874a6; }
        .issue-desc { color: #555; margin-bottom: 10px; }
        .issue-items { font-size: 0.9em; color: #666; font-family: monospace; margin: 10px 0; }
        .issue-recommendation {
            margin-top: 10px;
            padding: 10px;
            background: white;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .badge { 
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
            margin-right: 8px;
        }
        .badge.critical { background: #e74c3c; color: white; }
        .badge.warning { background: #f39c12; color: white; }
        .badge.info { background: #3498db; color: white; }
        .positive { color: #27ae60; margin: 10px 0; }
        .positive::before { content: "✓ "; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9em; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #3498db; color: white; font-weight: bold; position: sticky; top: 0; }
        tr:hover { background: #f5f5f5; }
        tr:nth-child(even) { background: #fafafa; }
        .cookie-section, .script-section { 
            background: white; 
            padding: 20px; 
            margin: 20px 0; 
            border-radius: 8px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            border-left: 4px solid #3498db;
        }
        .section-header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 15px 20px; 
            margin: -20px -20px 20px -20px; 
            border-radius: 8px 8px 0 0;
            font-size: 1.3em;
        }
        .table-container { overflow-x: auto; max-height: 600px; overflow-y: auto; }
        .table-info { background: #e8f4f8; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
        .no-issues { text-align: center; padding: 40px; color: #27ae60; font-size: 1.2em; }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Web Compliance Scan Report</h1>
            <div class="meta">
                <div><strong>URL:</strong> ${this.escapeHtml(results.url)}</div>
                <div><strong>Scan Date:</strong> ${results.timestamp.toLocaleString()}</div>
                <div><strong>Total Issues:</strong> ${results.summary.totalIssues} (${results.summary.criticalIssues} critical, ${results.summary.warningIssues} warnings)</div>
            </div>
        </div>

        ${this.buildScoreSection(results)}
        ${this.buildCookieTablesSection(results)}
        ${this.buildScriptTablesSection(results)}
        ${this.buildFrameworkSection(results)}
        ${this.buildStatsSection(results)}
        ${this.buildIssuesSection(results)}
        ${this.buildRecommendationsSection(results)}
    </div>
</body>
</html>`;
  }

  private buildScoreSection(results: ComplianceResults): string {
    const score = results.overallScore;
    let className = 'poor';
    let rating = 'Poor';

    if (score >= 90) { className = 'excellent'; rating = 'Excellent'; }
    else if (score >= 75) { className = 'good'; rating = 'Good'; }
    else if (score >= 60) { className = 'fair'; rating = 'Fair'; }

    return `
        <h2>Overall Compliance Score</h2>
        <div class="score-container">
            <div class="score-card ${className}">
                <div class="score-label">Overall Score</div>
                <div class="score-number">${score}</div>
                <div class="score-label">${rating}</div>
            </div>
        </div>
    `;
  }

  private buildFrameworkSection(results: ComplianceResults): string {
    return `
        <h2>Framework Scores</h2>
        <div class="framework-scores">
            <div class="framework-card">
                <div class="framework-name">GDPR</div>
                <div class="framework-score">${results.frameworkScores.gdpr}/100</div>
            </div>
            <div class="framework-card">
                <div class="framework-name">CCPA</div>
                <div class="framework-score">${results.frameworkScores.ccpa}/100</div>
            </div>
            <div class="framework-card">
                <div class="framework-name">ePrivacy Directive</div>
                <div class="framework-score">${results.frameworkScores.eprivacy}/100</div>
            </div>
        </div>
    `;
  }

  private buildStatsSection(results: ComplianceResults): string {
    return `
        <h2>Scan Statistics</h2>
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-label">Total Cookies</div>
                <div class="stat-value">${results.details.totalCookies}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Third-Party Cookies</div>
                <div class="stat-value ${results.details.thirdPartyCookies > 5 ? 'warning' : ''}">${results.details.thirdPartyCookies}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Cookies Before Consent</div>
                <div class="stat-value ${results.details.cookiesBeforeConsent > 2 ? 'warning' : ''}">${results.details.cookiesBeforeConsent}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Total Scripts</div>
                <div class="stat-value">${results.details.totalScripts}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Third-Party Scripts</div>
                <div class="stat-value ${results.details.thirdPartyScripts > 5 ? 'warning' : ''}">${results.details.thirdPartyScripts}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Consent Mechanism</div>
                <div class="stat-value">${results.details.consentMechanismFound ? '✓ Found' : '✗ Not Found'}</div>
            </div>
        </div>
        ${results.details.consentVendor ? `<p><strong>Consent Vendor:</strong> ${results.details.consentVendor}</p>` : ''}
    `;
  }

  private buildCookieTablesSection(results: ComplianceResults): string {
    if (!results.rawData) return '';

    const consentResults = results.rawData.consentResults;
    const scanResults = results.rawData.scanResults;

    let html = '<div class="cookie-section">';
    html += '<div class="section-header">🍪 COMPLETE COOKIE INVENTORY</div>';

    // Summary
    html += '<div class="table-info">';
    html += `<strong>Total Unique Cookies:</strong> ${scanResults.uniqueCookies.length} | `;
    html += `<strong>Third-Party:</strong> ${scanResults.thirdPartyCookies.length} | `;
    html += `<strong>Before Consent:</strong> ${consentResults.beforeConsent.cookies.length} | `;
    html += `<strong>After Accept:</strong> ${consentResults.afterAcceptAll.cookies.length}`;
    html += '</div>';

    // Section 1: Cookies Before Consent (CRITICAL)
    html += '<h3 style="color: #e74c3c; margin-top: 30px;">⚠️ Cookies Set BEFORE User Consent</h3>';
    html += '<p>These cookies were set immediately upon page load, before any user interaction:</p>';
    if (consentResults.beforeConsent.cookies.length > 0) {
      html += '<div class="table-container"><table>';
      html += '<thead><tr>';
      html += '<th>Cookie Name</th><th>Domain</th><th>Path</th><th>Type</th><th>Expires</th><th>Secure</th><th>HttpOnly</th><th>SameSite</th>';
      html += '</tr></thead><tbody>';
      
      for (const cookie of consentResults.beforeConsent.cookies) {
        const expiryDate = cookie.expires ? new Date(cookie.expires * 1000).toLocaleDateString() : 'Session';
        const rowStyle = cookie.isThirdParty ? 'style="background: #ffe6e6;"' : '';
        html += `<tr ${rowStyle}>`;
        html += `<td><strong>${this.escapeHtml(cookie.name)}</strong></td>`;
        html += `<td>${this.escapeHtml(cookie.domain)}</td>`;
        html += `<td>${this.escapeHtml(cookie.path)}</td>`;
        html += `<td>${cookie.isThirdParty ? '<span style="color: #e74c3c; font-weight: bold;">Third-Party</span>' : '<span style="color: #27ae60;">First-Party</span>'}</td>`;
        html += `<td>${expiryDate}</td>`;
        html += `<td>${cookie.secure ? '✓' : '✗'}</td>`;
        html += `<td>${cookie.httpOnly ? '✓' : '✗'}</td>`;
        html += `<td>${cookie.sameSite || 'None'}</td>`;
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    } else {
      html += '<p style="color: #27ae60; background: #e8f5e9; padding: 15px; border-radius: 4px;">✓ Excellent! No cookies set before consent.</p>';
    }

    // Section 2: Cookies After Accept All
    html += '<h3 style="color: #2980b9; margin-top: 40px;">Cookies Set AFTER Accepting All</h3>';
    html += '<p>These cookies were set after the user clicked "Accept All":</p>';
    if (consentResults.afterAcceptAll.cookies.length > 0) {
      html += '<div class="table-container"><table>';
      html += '<thead><tr>';
      html += '<th>Cookie Name</th><th>Domain</th><th>Path</th><th>Type</th><th>Expires</th><th>Secure</th><th>HttpOnly</th><th>SameSite</th>';
      html += '</tr></thead><tbody>';
      
      for (const cookie of consentResults.afterAcceptAll.cookies) {
        const expiryDate = cookie.expires ? new Date(cookie.expires * 1000).toLocaleDateString() : 'Session';
        const rowStyle = cookie.isThirdParty ? 'style="background: #fff3cd;"' : '';
        html += `<tr ${rowStyle}>`;
        html += `<td><strong>${this.escapeHtml(cookie.name)}</strong></td>`;
        html += `<td>${this.escapeHtml(cookie.domain)}</td>`;
        html += `<td>${this.escapeHtml(cookie.path)}</td>`;
        html += `<td>${cookie.isThirdParty ? '<span style="color: #e74c3c; font-weight: bold;">Third-Party</span>' : '<span style="color: #27ae60;">First-Party</span>'}</td>`;
        html += `<td>${expiryDate}</td>`;
        html += `<td>${cookie.secure ? '✓' : '✗'}</td>`;
        html += `<td>${cookie.httpOnly ? '✓' : '✗'}</td>`;
        html += `<td>${cookie.sameSite || 'None'}</td>`;
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    // Section 3: ALL Unique Cookies Found
    html += '<h3 style="color: #8e44ad; margin-top: 40px;">📋 Complete Cookie Inventory (All Pages)</h3>';
    html += '<p>Every unique cookie found across all scanned pages:</p>';
    if (scanResults.uniqueCookies.length > 0) {
      html += '<div class="table-container"><table>';
      html += '<thead><tr>';
      html += '<th>Cookie Name</th><th>Domain</th><th>Path</th><th>Type</th><th>Expires</th><th>Secure</th><th>HttpOnly</th><th>SameSite</th><th>Found On</th>';
      html += '</tr></thead><tbody>';
      
      for (const cookie of scanResults.uniqueCookies) {
        const expiryDate = cookie.expires ? new Date(cookie.expires * 1000).toLocaleDateString() : 'Session';
        const rowStyle = cookie.isThirdParty ? 'style="background: #fff3cd;"' : '';
        html += `<tr ${rowStyle}>`;
        html += `<td><strong>${this.escapeHtml(cookie.name)}</strong></td>`;
        html += `<td>${this.escapeHtml(cookie.domain)}</td>`;
        html += `<td>${this.escapeHtml(cookie.path)}</td>`;
        html += `<td>${cookie.isThirdParty ? '<span style="color: #e74c3c; font-weight: bold;">Third-Party</span>' : '<span style="color: #27ae60;">First-Party</span>'}</td>`;
        html += `<td>${expiryDate}</td>`;
        html += `<td>${cookie.secure ? '✓' : '✗'}</td>`;
        html += `<td>${cookie.httpOnly ? '✓' : '✗'}</td>`;
        html += `<td>${cookie.sameSite || 'None'}</td>`;
        html += `<td style="font-size: 0.8em; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(cookie.foundOnUrl)}</td>`;
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }

  private buildScriptTablesSection(results: ComplianceResults): string {
    if (!results.rawData) return '';

    const consentResults = results.rawData.consentResults;
    const scanResults = results.rawData.scanResults;

    let html = '<div class="script-section">';
    html += '<div class="section-header">📜 COMPLETE SCRIPT & TRACKER INVENTORY</div>';

    // Summary
    html += '<div class="table-info">';
    html += `<strong>Total Scripts:</strong> ${scanResults.uniqueScripts.length} | `;
    html += `<strong>Third-Party:</strong> ${scanResults.thirdPartyScripts.length} | `;
    html += `<strong>Before Consent:</strong> ${consentResults.beforeConsent.scripts.length}`;
    html += '</div>';

    // Section 1: Scripts Before Consent (CRITICAL)
    html += '<h3 style="color: #e74c3c; margin-top: 30px;">⚠️ Scripts Loaded BEFORE User Consent</h3>';
    html += '<p>These scripts executed immediately upon page load, before any user interaction:</p>';
    if (consentResults.beforeConsent.scripts.length > 0) {
      html += '<div class="table-container"><table>';
      html += '<thead><tr>';
      html += '<th style="width: 80px;">Type</th><th>URL/Source</th><th style="width: 100px;">Third-Party</th><th style="width: 120px;">Category</th><th style="width: 150px;">Vendor</th>';
      html += '</tr></thead><tbody>';
      
      for (const script of consentResults.beforeConsent.scripts) {
        const vendor = this.detectVendor(script.url);
        const rowStyle = script.isThirdParty ? 'style="background: #ffe6e6;"' : '';
        html += `<tr ${rowStyle}>`;
        html += `<td>${script.type === 'external' ? 'External' : 'Inline'}</td>`;
        html += `<td style="word-break: break-all; font-family: monospace; font-size: 0.85em;">${this.escapeHtml(script.url)}</td>`;
        html += `<td>${script.isThirdParty ? '<span style="color: #e74c3c; font-weight: bold;">Yes</span>' : '<span style="color: #27ae60;">No</span>'}</td>`;
        html += `<td><span style="background: #e8f4f8; padding: 3px 8px; border-radius: 3px; font-size: 0.85em;">${script.category || 'unknown'}</span></td>`;
        html += `<td><strong>${vendor}</strong></td>`;
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    } else {
      html += '<p style="color: #27ae60; background: #e8f5e9; padding: 15px; border-radius: 4px;">✓ Excellent! No third-party scripts loaded before consent.</p>';
    }

    // Section 2: ALL Third-Party Scripts
    html += '<h3 style="color: #e74c3c; margin-top: 40px;">🌐 All Third-Party Scripts (Complete List)</h3>';
    html += '<p>Every third-party script found across the entire site:</p>';
    const thirdPartyScripts = scanResults.thirdPartyScripts;
    if (thirdPartyScripts.length > 0) {
      html += '<div class="table-container"><table>';
      html += '<thead><tr>';
      html += '<th style="width: 80px;">Type</th><th>URL</th><th style="width: 120px;">Category</th><th style="width: 150px;">Vendor</th><th style="width: 200px;">Found On</th>';
      html += '</tr></thead><tbody>';
      
      for (const script of thirdPartyScripts) {
        const vendor = this.detectVendor(script.url);
        html += '<tr>';
        html += `<td>${script.type === 'external' ? 'External' : 'Inline'}</td>`;
        html += `<td style="word-break: break-all; font-family: monospace; font-size: 0.85em;">${this.escapeHtml(script.url)}</td>`;
        html += `<td><span style="background: #e8f4f8; padding: 3px 8px; border-radius: 3px; font-size: 0.85em;">${script.category || 'unknown'}</span></td>`;
        html += `<td><strong>${vendor}</strong></td>`;
        html += `<td style="font-size: 0.8em; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(script.foundOnUrl)}</td>`;
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    } else {
      html += '<p style="color: #27ae60;">No third-party scripts found.</p>';
    }

    // Section 3: ALL Scripts (First and Third Party)
    html += '<h3 style="color: #8e44ad; margin-top: 40px;">📋 Complete Script Inventory (All Scripts)</h3>';
    html += '<p>Every script found across all scanned pages, including first-party:</p>';
    if (scanResults.uniqueScripts.length > 0) {
      html += '<div class="table-container"><table>';
      html += '<thead><tr>';
      html += '<th style="width: 80px;">Type</th><th>URL</th><th style="width: 100px;">Party</th><th style="width: 120px;">Category</th><th style="width: 150px;">Vendor</th><th style="width: 200px;">Found On</th>';
      html += '</tr></thead><tbody>';
      
      for (const script of scanResults.uniqueScripts) {
        const vendor = this.detectVendor(script.url);
        const rowStyle = script.isThirdParty ? 'style="background: #fff3cd;"' : '';
        html += `<tr ${rowStyle}>`;
        html += `<td>${script.type === 'external' ? 'External' : 'Inline'}</td>`;
        html += `<td style="word-break: break-all; font-family: monospace; font-size: 0.85em;">${this.escapeHtml(script.url)}</td>`;
        html += `<td>${script.isThirdParty ? '<span style="color: #e74c3c; font-weight: bold;">Third</span>' : '<span style="color: #27ae60;">First</span>'}</td>`;
        html += `<td><span style="background: #e8f4f8; padding: 3px 8px; border-radius: 3px; font-size: 0.85em;">${script.category || 'unknown'}</span></td>`;
        html += `<td><strong>${vendor}</strong></td>`;
        html += `<td style="font-size: 0.8em; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(script.foundOnUrl)}</td>`;
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }

  private detectVendor(url: string): string {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('google-analytics') || urlLower.includes('googletagmanager')) return 'Google Analytics';
    if (urlLower.includes('facebook')) return 'Facebook';
    if (urlLower.includes('doubleclick')) return 'Google Ads';
    if (urlLower.includes('hubspot')) return 'HubSpot';
    if (urlLower.includes('linkedin')) return 'LinkedIn';
    if (urlLower.includes('twitter')) return 'Twitter';
    if (urlLower.includes('youtube')) return 'YouTube';
    if (urlLower.includes('vimeo')) return 'Vimeo';
    if (urlLower.includes('hotjar')) return 'Hotjar';
    if (urlLower.includes('cookiebot')) return 'Cookiebot';
    if (urlLower.includes('onetrust')) return 'OneTrust';
    
    // Try to extract domain as vendor
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  private buildIssuesSection(results: ComplianceResults): string {
    if (results.issues.length === 0) {
      return '<h2>Issues</h2><div class="no-issues">✓ No compliance issues found!</div>';
    }

    const criticalIssues = results.issues.filter(i => i.severity === 'critical');
    const warningIssues = results.issues.filter(i => i.severity === 'warning');
    const infoIssues = results.issues.filter(i => i.severity === 'info');

    let html = '<h2>Issues Found</h2>';

    if (criticalIssues.length > 0) {
      html += '<h3>Critical Issues</h3>';
      for (const issue of criticalIssues) {
        html += this.buildIssueCard(issue);
      }
    }

    if (warningIssues.length > 0) {
      html += '<h3>Warnings</h3>';
      for (const issue of warningIssues) {
        html += this.buildIssueCard(issue);
      }
    }

    if (infoIssues.length > 0) {
      html += '<h3>Informational</h3>';
      for (const issue of infoIssues) {
        html += this.buildIssueCard(issue);
      }
    }

    return html;
  }

  private buildIssueCard(issue: any): string {
    const items = issue.affectedItems.length > 0 
      ? `<div class="issue-items"><strong>Affected items:</strong><br>${issue.affectedItems.slice(0, 5).map((i: string) => this.escapeHtml(i)).join('<br>')}</div>`
      : '';

    return `
        <div class="issue ${issue.severity}">
            <div class="issue-title ${issue.severity}">
                <span class="badge ${issue.severity}">${issue.severity.toUpperCase()}</span>
                ${this.escapeHtml(issue.title)}
            </div>
            <div class="issue-desc">${this.escapeHtml(issue.description)}</div>
            ${items}
            <div class="issue-recommendation">
                <strong>💡 Recommendation:</strong> ${this.escapeHtml(issue.recommendation)}
            </div>
        </div>
    `;
  }

  private buildRecommendationsSection(results: ComplianceResults): string {
    const positives: string[] = [];

    if (results.details.consentMechanismFound) {
      positives.push('Consent mechanism is present');
    }
    if (results.details.cookiesBeforeConsent <= 2) {
      positives.push('Limited cookies before consent');
    }
    if (results.overallScore >= 75) {
      positives.push('Good overall compliance');
    }

    if (positives.length === 0) return '';

    return `
        <h2>Positive Findings</h2>
        ${positives.map(p => `<div class="positive">${this.escapeHtml(p)}</div>`).join('')}
    `;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private generateFilename(url: string): string {
    const date = new Date().toISOString().split('T')[0];
    const hostname = new URL(url).hostname.replace(/\./g, '-');
    return `compliance-report-${hostname}-${date}.html`;
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
}
