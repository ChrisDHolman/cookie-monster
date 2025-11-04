import { ComplianceResults } from '../compliance/types';
import { logger } from '../utils/logger';

export interface AISummary {
  executiveSummary: string;
  cookieSecurityAssessment: string;
  preConsentViolations: string;
  keyFindings: string[];
  criticalIssues: string[];
  recommendations: string[];
  complianceOutlook: string;
}

export class AISummarizer {
  /**
   * Generate AI-powered summary of compliance scan
   */
  async generateSummary(results: ComplianceResults): Promise<AISummary> {
    try {
      logger.info('Starting AI summary generation...');

      const prompt = this.buildPrompt(results);
      logger.info('Prompt built, calling Claude API...');
      
      const response = await this.callClaudeAPI(prompt);
      logger.info('API response received, parsing...');
      
      const parsed = this.parseResponse(response);
      logger.info('AI summary generated successfully');
      
      return parsed;
    } catch (error) {
      logger.error('Failed to generate AI summary:', error);
      logger.error('Error details:', error instanceof Error ? error.message : String(error));
      return this.getFallbackSummary(results);
    }
  }

  /**
   * Build detailed prompt for Claude
   */
  private buildPrompt(results: ComplianceResults): string {
    const cookieAnalysis = results.rawData?.scanResults.cookieAnalysis || [];
    const consentResults = results.rawData?.consentResults;
    
    // Count risk levels
    const riskCounts = {
      critical: cookieAnalysis.filter((a: any) => a.riskLevel === 'critical').length,
      high: cookieAnalysis.filter((a: any) => a.riskLevel === 'high').length,
      medium: cookieAnalysis.filter((a: any) => a.riskLevel === 'medium').length,
      low: cookieAnalysis.filter((a: any) => a.riskLevel === 'low').length
    };

    // Get top vendors
    const vendorCounts = new Map<string, number>();
    cookieAnalysis.forEach((a: any) => {
      const count = vendorCounts.get(a.actualVendor) || 0;
      vendorCounts.set(a.actualVendor, count + 1);
    });
    const topVendors = Array.from(vendorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([vendor, count]) => `${vendor} (${count} cookies)`);

    // Get cookies loaded before consent with details
    const cookiesBeforeConsent = consentResults?.beforeConsent.cookies.map((c: any) => {
      const analysis = cookieAnalysis.find((a: any) => a.cookie.name === c.name);
      return {
        name: c.name,
        vendor: analysis?.actualVendor || c.domain,
        purpose: analysis?.purpose || 'Unknown',
        risk: analysis?.riskLevel || 'unknown',
        isThirdParty: analysis?.isActuallyThirdParty || c.isThirdParty
      };
    }) || [];

    const highRiskBeforeConsent = cookiesBeforeConsent.filter((c: any) => 
      c.risk === 'critical' || c.risk === 'high'
    );

    // Get scripts loaded before consent
    const scriptsBeforeConsent = consentResults?.beforeConsent.scripts
      .filter((s: any) => s.isThirdParty)
      .map((s: any) => s.url) || [];

    return `You are a senior privacy and data protection consultant writing a detailed compliance assessment report. Your client needs a thorough, narrative analysis of their website's cookie and tracking implementation.

WEBSITE ANALYZED: ${results.url}
ASSESSMENT DATE: ${results.timestamp.toLocaleString()}

═══════════════════════════════════════════════════════════════════════════════
COMPLIANCE SCORING
═══════════════════════════════════════════════════════════════════════════════
Overall Compliance: ${results.overallScore}/100
GDPR Compliance: ${results.frameworkScores.gdpr}/100
CCPA Compliance: ${results.frameworkScores.ccpa}/100
ePrivacy Directive: ${results.frameworkScores.eprivacy}/100

═══════════════════════════════════════════════════════════════════════════════
PRE-CONSENT VIOLATIONS (CRITICAL SECTION)
═══════════════════════════════════════════════════════════════════════════════

COOKIES LOADING BEFORE USER CONSENT:
Total: ${results.details.cookiesBeforeConsent} cookies
High-Risk Pre-Consent Cookies: ${highRiskBeforeConsent.length}

Detailed Breakdown:
${cookiesBeforeConsent.slice(0, 15).map((c: any) => 
  `• ${c.name} → ${c.vendor} (${c.purpose}) [Risk: ${c.risk.toUpperCase()}] ${c.isThirdParty ? '⚠️ THIRD-PARTY' : ''}`
).join('\n')}

TRACKING SCRIPTS LOADING BEFORE CONSENT:
Total Third-Party Scripts: ${scriptsBeforeConsent.length}
${scriptsBeforeConsent.slice(0, 12).map((s: any) => `• ${s}`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
COOKIE SECURITY ANALYSIS
═══════════════════════════════════════════════════════════════════════════════
Total Unique Cookies: ${results.rawData?.scanResults.uniqueCookies.length || 0}
Third-Party Tracking Cookies: ${results.rawData?.scanResults.thirdPartyCookies.length || 0}
First-Party Cookies: ${(results.rawData?.scanResults.uniqueCookies.length || 0) - (results.rawData?.scanResults.thirdPartyCookies.length || 0)}

Security Risk Distribution:
• CRITICAL Risk: ${riskCounts.critical} cookies (immediate privacy violations)
• HIGH Risk: ${riskCounts.high} cookies (significant tracking/data collection)
• MEDIUM Risk: ${riskCounts.medium} cookies (moderate privacy concerns)
• LOW Risk: ${riskCounts.low} cookies (minimal risk)

═══════════════════════════════════════════════════════════════════════════════
THIRD-PARTY VENDOR ECOSYSTEM
═══════════════════════════════════════════════════════════════════════════════
The following vendors have tracking presence on this website:
${topVendors.slice(0, 12).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
CONSENT MECHANISM EVALUATION
═══════════════════════════════════════════════════════════════════════════════
Consent Banner Present: ${results.details.consentMechanismFound ? '✓ YES' : '✗ NO - CRITICAL VIOLATION'}
Consent Technology: ${results.details.consentVendor || 'Unknown/Custom Implementation'}

Effectiveness Testing Results:
• Before Any Interaction: ${results.details.cookiesBeforeConsent} cookies active
• After "Accept All": ${consentResults?.afterAcceptAll.cookies.length || 0} cookies active
• After "Reject All": ${consentResults?.afterRejectAll.cookies.length || 0} cookies active

${consentResults && consentResults.afterRejectAll.cookies.length > results.details.cookiesBeforeConsent + 2 ? 
  '⚠️ CRITICAL: Reject functionality appears ineffective - cookies still being set after rejection' : 
  '✓ Reject functionality appears to work'}

═══════════════════════════════════════════════════════════════════════════════
REGULATORY COMPLIANCE VIOLATIONS
═══════════════════════════════════════════════════════════════════════════════
Total Violations Identified: ${results.summary.totalIssues}
• Critical Violations: ${results.summary.criticalIssues} (immediate legal exposure)
• Warnings: ${results.summary.warningIssues} (compliance concerns)
• Advisory Items: ${results.summary.infoIssues}

Specific Violations:
${results.issues.slice(0, 10).map((i, idx) => 
  `${idx + 1}. [${i.framework.toUpperCase()}] ${i.title}\n   ${i.description}`
).join('\n\n')}

═══════════════════════════════════════════════════════════════════════════════
LEGAL AND FINANCIAL RISK ASSESSMENT
═══════════════════════════════════════════════════════════════════════════════

GDPR Risk Exposure:
• Maximum Penalty: €20 million or 4% of global annual revenue (whichever is higher)
• Enforcement Trend: Data Protection Authorities actively pursuing cookie violations
• Recent Cases: €1.2M+ fines issued for similar pre-consent tracking violations

CCPA Risk Exposure:
• Statutory Damages: Up to $7,500 per intentional violation
• Class Action Exposure: Private right of action for data breaches
• Recent Settlements: Multi-million dollar settlements for tracking violations

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK - WRITE A DETAILED NARRATIVE ASSESSMENT
═══════════════════════════════════════════════════════════════════════════════

Write a comprehensive, narrative analysis covering these aspects:

1. EXECUTIVE SUMMARY (2-3 detailed paragraphs):
   - Open with the MOST CRITICAL finding (likely pre-consent tracking)
   - Explain HOW MANY cookies/scripts are violating which specific laws
   - Name the SPECIFIC vendors involved (e.g., "Microsoft Clarity", "Snitcher", "LinkedIn Insight")
   - Quantify the legal exposure (cite GDPR fines, CCPA penalties)
   - Give a clear verdict: "This implementation is non-compliant" or "partially compliant with critical gaps"

2. COOKIE SECURITY ASSESSMENT (2 paragraphs):
   - Analyze the overall security posture of cookie implementation
   - Discuss the ${results.details.cookiesBeforeConsent} cookies loading before consent - WHY is this a problem?
   - Evaluate third-party tracking scope (${results.rawData?.scanResults.thirdPartyCookies.length || 0} third-party cookies)
   - Discuss the risk distribution (${riskCounts.critical} critical, ${riskCounts.high} high risk)
   - Comment on security flags (HttpOnly, Secure, SameSite) based on the data
   - Explain what makes this implementation secure or insecure

3. PRE-CONSENT TRACKING VIOLATIONS (1-2 paragraphs):
   - Detail EXACTLY which vendors are tracking before consent
   - Explain WHY each vendor's presence violates GDPR/ePrivacy
   - Name specific cookies that shouldn't be there (reference the list above)
   - Explain the privacy implications of ${scriptsBeforeConsent.length} tracking scripts loading immediately
   - Make this specific to THIS scan's findings

4. KEY FINDINGS (5-7 detailed bullet points):
   - Each finding should be SPECIFIC to this website's implementation
   - Reference actual vendor names and cookie names
   - Explain the compliance/privacy impact
   - Include quantitative data from this scan
   Example: "Microsoft Clarity session recording initiates before consent, capturing user behavior including potential PII through ${scriptsBeforeConsent.filter((s: any) => s.includes('clarity')).length} script files"

5. CRITICAL ISSUES (3-5 detailed points):
   - Focus on violations with immediate enforcement risk
   - Be specific about WHICH law is violated and HOW
   - Explain potential penalties
   - Priority ranked by legal/financial risk

6. ACTIONABLE RECOMMENDATIONS (5-8 specific points):
   - TECHNICAL recommendations (e.g., "Implement consent.js wrapper to block Microsoft Clarity until consent")
   - Each should address a specific finding
   - Include implementation approach
   - Prioritize by impact and effort
   Example: "Block ${highRiskBeforeConsent.length} high-risk tracking cookies: Configure Cookie-Script.com to prevent Snitcher, LinkedIn Insight, and Microsoft Clarity from initializing until explicit user consent"

7. COMPLIANCE OUTLOOK (2 paragraphs):
   - Clear assessment: compliant, non-compliant, or partially compliant
   - Specific legal risks under each framework
   - Timeline and urgency for remediation
   - Cost/complexity estimate for becoming compliant

CRITICAL WRITING REQUIREMENTS:
❌ NO generic statements like "cookies were found"
❌ NO repetition of the raw data without analysis
❌ NO vague advice like "review your cookies"

✅ YES - Name specific vendors and explain their tracking methods
✅ YES - Explain WHY findings matter for compliance and privacy
✅ YES - Use the specific numbers and findings from THIS scan
✅ YES - Write in narrative paragraph form (not bullet lists) for the main sections
✅ YES - Make every sentence add unique value and insight
✅ YES - Reference specific cookies, vendors, and violations by name

This should read like a professional consulting report that analyzes THIS SPECIFIC WEBSITE, not a generic template.

Return ONLY valid JSON (no markdown, no code fences):
{
  "executiveSummary": "2-3 detailed paragraphs with specific vendor names, cookie names, violation counts, and clear legal risk assessment. Must be narrative and unique to this scan.",
  "cookieSecurityAssessment": "2 paragraphs analyzing the security posture, pre-consent loading issues, third-party tracking scope, and risk distribution. Explain what makes this implementation secure or insecure.",
  "preConsentViolations": "1-2 paragraphs specifically detailing which vendors are tracking before consent, which laws are violated, and the privacy implications. Reference actual cookie/script names.",
  "keyFindings": [
    "5-7 specific, detailed findings with actual vendor/cookie names and quantitative data from this scan. Each should explain the compliance/privacy impact."
  ],
  "criticalIssues": [
    "3-5 urgent problems with specific legal framework references, penalty exposure, and technical details. Priority ranked."
  ],
  "recommendations": [
    "5-8 actionable, technical recommendations addressing specific findings. Include implementation approach and priority."
  ],
  "complianceOutlook": "2 paragraphs with clear compliance verdict, specific legal risks under GDPR/CCPA/ePrivacy, remediation timeline, and complexity/cost estimate."
}`;
  }

  /**
   * Call Claude API
   */
  private async callClaudeAPI(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    
    // Extract text from response
    const text = data.content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n');

    return text;
  }

  /**
   * Parse Claude's response
   */
  private parseResponse(response: string): AISummary {
    try {
      // Remove any markdown code fences if present
      let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(cleaned);
      return {
        executiveSummary: parsed.executiveSummary || '',
        keyFindings: parsed.keyFindings || [],
        criticalIssues: parsed.criticalIssues || [],
        recommendations: parsed.recommendations || [],
        complianceOutlook: parsed.complianceOutlook || ''
      };
    } catch (error) {
      logger.error('Failed to parse AI response:', error);
      logger.debug('Raw response:', response);
      throw error;
    }
  }

  /**
   * Fallback summary if AI fails
   */
  private getFallbackSummary(results: ComplianceResults): AISummary {
    logger.info('Using fallback summary');
    
    const score = results.overallScore;
    let outlook = 'Good';
    if (score < 60) outlook = 'Poor';
    else if (score < 75) outlook = 'Fair';
    else if (score < 90) outlook = 'Good';
    else outlook = 'Excellent';

    return {
      executiveSummary: `This website received a compliance score of ${score}/100 (${outlook}). ${results.summary.criticalIssues} critical issues and ${results.summary.warningIssues} warnings were identified across GDPR, CCPA, and ePrivacy frameworks.`,
      keyFindings: [
        `${results.details.totalCookies} cookies found (${results.details.thirdPartyCookies} third-party)`,
        `${results.details.cookiesBeforeConsent} cookies set before user consent`,
        `${results.details.totalScripts} scripts detected (${results.details.thirdPartyScripts} third-party)`,
        `Consent mechanism: ${results.details.consentMechanismFound ? 'Present' : 'Not found'}`
      ],
      criticalIssues: results.issues
        .filter(i => i.severity === 'critical')
        .slice(0, 3)
        .map(i => i.title),
      recommendations: [
        'Review and minimize cookies set before consent',
        'Ensure all third-party trackers are properly disclosed',
        'Implement or improve cookie consent mechanism',
        'Audit high-risk cookies for compliance'
      ],
      complianceOutlook: `Overall compliance: ${outlook}. ${results.summary.criticalIssues > 0 ? 'Immediate action required on critical issues.' : 'Minor improvements recommended.'}`
    };
  }
}
