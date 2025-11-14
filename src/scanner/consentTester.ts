import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { Cookie, Script, Request, ConsentTestResult } from './types';
import { logger } from '../utils/logger';

export class ConsentTester {
  private browser: Browser | null = null;

  /**
   * Test consent mechanisms on a page
   */
  async testConsent(url: string): Promise<ConsentTestResult> {
    try {
      await this.init();

      const result: ConsentTestResult = {
        url,
        beforeConsent: { cookies: [], scripts: [], requests: [] },
        afterAcceptAll: { cookies: [], scripts: [], requests: [] },
        afterRejectAll: { cookies: [], scripts: [], requests: [] },
        consentMechanismFound: false
      };

      // Test 1: Before consent
      logger.info('Testing before consent...');
      result.beforeConsent = await this.captureState(url, 'before');

      // Test 2: After accepting all
      logger.info('Testing after accept all...');
      const acceptResult = await this.captureStateWithAction(url, 'accept');
      result.afterAcceptAll = acceptResult.state;
      result.consentMechanismFound = acceptResult.consentFound;
      result.consentVendor = acceptResult.vendor;

      // Test 3: After rejecting all
      logger.info('Testing after reject all...');
      const rejectResult = await this.captureStateWithAction(url, 'reject');
      result.afterRejectAll = rejectResult.state;

      return result;

    } finally {
      await this.cleanup();
    }
  }

  /**
   * Capture state without interacting with consent
   */
  private async captureState(url: string, scenario: string): Promise<{
    cookies: Cookie[];
    scripts: Script[];
    requests: Request[];
  }> {
    if (!this.browser) throw new Error('Browser not initialized');

    const context = await this.browser.newContext();
    const page = await context.newPage();
    
    const cookies: Cookie[] = [];
    const scripts: Script[] = [];
    const requests: Request[] = [];

    try {
      // Set shorter timeout
      page.setDefaultTimeout(20000);
      
      // Track requests
      page.on('request', (request) => {
        requests.push({
          url: request.url(),
          type: request.resourceType(),
          isThirdParty: this.isThirdParty(request.url(), url),
          foundOnUrl: url
        });
      });

      // Navigate
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      
      // Wait for potential consent dialogs
      await page.waitForTimeout(3000);

      // Capture cookies
      const pageCookies = await context.cookies();
      for (const cookie of pageCookies) {
        cookies.push({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite as any,
          isThirdParty: this.isThirdParty(cookie.domain, url),
          foundOnUrl: url
        });
      }

      // Capture scripts
      const scriptElements = await page.$$('script[src]');
      for (const scriptEl of scriptElements) {
        const src = await scriptEl.getAttribute('src');
        if (src) {
          const absoluteUrl = new URL(src, url).href;
          scripts.push({
            url: absoluteUrl,
            type: 'external',
            isThirdParty: this.isThirdParty(absoluteUrl, url),
            foundOnUrl: url
          });
        }
      }

      logger.info(`${scenario}: ${cookies.length} cookies, ${scripts.length} scripts, ${requests.length} requests`);

      return { cookies, scripts, requests };

    } finally {
      await context.close();
    }
  }

  /**
   * Capture state after performing a consent action
   */
  private async captureStateWithAction(url: string, action: 'accept' | 'reject'): Promise<{
    state: { cookies: Cookie[]; scripts: Script[]; requests: Request[] };
    consentFound: boolean;
    vendor?: string;
  }> {
    if (!this.browser) throw new Error('Browser not initialized');

    const context = await this.browser.newContext();
    const page = await context.newPage();
    
    const cookies: Cookie[] = [];
    const scripts: Script[] = [];
    const requests: Request[] = [];
    let consentFound = false;
    let vendor: string | undefined;

    try {
      // Track requests
      page.on('request', (request) => {
        requests.push({
          url: request.url(),
          type: request.resourceType(),
          isThirdParty: this.isThirdParty(request.url(), url),
          foundOnUrl: url
        });
      });

      // Navigate
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      
      // Wait for consent dialog
      await page.waitForTimeout(3000);

      // Try to find and click consent button
      const clickResult = await this.findAndClickConsent(page, action);
      consentFound = clickResult.found;
      vendor = clickResult.vendor;

      if (consentFound) {
        // Wait for consent action to complete
        await page.waitForTimeout(2000);
      }

      // Capture cookies
      const pageCookies = await context.cookies();
      for (const cookie of pageCookies) {
        cookies.push({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite as any,
          isThirdParty: this.isThirdParty(cookie.domain, url),
          foundOnUrl: url
        });
      }

      // Capture scripts
      const scriptElements = await page.$$('script[src]');
      for (const scriptEl of scriptElements) {
        const src = await scriptEl.getAttribute('src');
        if (src) {
          const absoluteUrl = new URL(src, url).href;
          scripts.push({
            url: absoluteUrl,
            type: 'external',
            isThirdParty: this.isThirdParty(absoluteUrl, url),
            foundOnUrl: url
          });
        }
      }

      logger.info(`After ${action}: ${cookies.length} cookies, ${scripts.length} scripts`);

      return {
        state: { cookies, scripts, requests },
        consentFound,
        vendor
      };

    } finally {
      await context.close();
    }
  }

  /**
   * Try to find and click consent buttons
   */
  private async findAndClickConsent(page: Page, action: 'accept' | 'reject'): Promise<{
    found: boolean;
    vendor?: string;
  }> {
    const acceptSelectors = [
      // Common text patterns
      'button:has-text("Accept")',
      'button:has-text("Accept All")',
      'button:has-text("Accept all")',
      'button:has-text("Agree")',
      'button:has-text("I agree")',
      'button:has-text("OK")',
      'a:has-text("Accept")',
      '[role="button"]:has-text("Accept")',
      
      // OneTrust
      '#onetrust-accept-btn-handler',
      '.onetrust-close-btn-handler',
      
      // Cookie Consent
      '.cc-accept',
      '.cc-allow',
      
      // Cookiebot
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',

      // Osano
      '.osano-cm-accept-all',
      '.osano-cm-button--type_accept',
      'button[data-osano="accept"]',

      // Termly
      '#accept-all-button',
      '.t-accept-all-button',
      '.t-preference-button[data-action="accept"]',

      // TrustArc
      '#truste-consent-button',
      '.trustarc-accept-btn',
      '.truste-button1',

      // GDPR Cookie Consent
      '.gdpr-cookie-accept',

      // Generic classes
      '.cookie-accept',
      '.accept-cookies',
      '.consent-accept'
    ];

    const rejectSelectors = [
      // Common text patterns
      'button:has-text("Reject")',
      'button:has-text("Reject All")',
      'button:has-text("Decline")',
      'button:has-text("No thanks")',
      'a:has-text("Reject")',
      
      // OneTrust
      '#onetrust-reject-all-handler',
      '.onetrust-reject-all',
      
      // Cookiebot
      '#CybotCookiebotDialogBodyButtonDecline',

      // Osano
      '.osano-cm-deny-all',
      '.osano-cm-button--type_deny',
      'button[data-osano="deny"]',

      // Termly
      '#reject-all-button',
      '.t-reject-all-button',
      '.t-preference-button[data-action="reject"]',

      // TrustArc
      '#truste-consent-required',
      '.trustarc-reject-btn',
      '.truste-button2',

      // Generic classes
      '.cookie-reject',
      '.reject-cookies',
      '.consent-reject'
    ];

    const selectors = action === 'accept' ? acceptSelectors : rejectSelectors;

    // Try each selector
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          logger.info(`Clicked ${action} button: ${selector}`);
          
          // Detect vendor
          let vendor: string | undefined;
          if (selector.includes('onetrust')) vendor = 'OneTrust';
          else if (selector.includes('Cookiebot') || selector.includes('Cybot')) vendor = 'Cookiebot';
          else if (selector.includes('osano')) vendor = 'Osano';
          else if (selector.includes('termly') || selector.includes('t-')) vendor = 'Termly';
          else if (selector.includes('truste') || selector.includes('trustarc')) vendor = 'TrustArc';
          else if (selector.includes('cc-')) vendor = 'Cookie Consent';

          return { found: true, vendor };
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }

    logger.warn(`No ${action} button found`);
    return { found: false };
  }

  /**
   * Check if third party
   */
  private isThirdParty(urlOrDomain: string, baseUrl: string): boolean {
    try {
      const baseHostname = new URL(baseUrl).hostname;
      let testHostname: string;

      if (urlOrDomain.startsWith('http')) {
        testHostname = new URL(urlOrDomain).hostname;
      } else {
        testHostname = urlOrDomain.startsWith('.') ? urlOrDomain.substring(1) : urlOrDomain;
      }

      const baseNormalized = baseHostname.replace(/^www\./, '');
      const testNormalized = testHostname.replace(/^www\./, '');

      return !testNormalized.endsWith(baseNormalized);
    } catch {
      return false;
    }
  }

  /**
   * Initialize browser
   */
  private async init(): Promise<void> {
    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    });
  }

  /**
   * Cleanup
   */
  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
