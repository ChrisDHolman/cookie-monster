import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { CrawlConfig, PageInfo, CrawlError } from './types';
import { UrlQueue } from './urlQueue';
import { logger } from '../utils/logger';
import ora from 'ora';

export class Crawler {
  private config: CrawlConfig;
  private browser: Browser | null = null;
  private urlQueue: UrlQueue;
  private pages: PageInfo[] = [];
  private errors: CrawlError[] = [];
  private spinner = ora();
  private readonly MAX_PAGES = 100; // Limit to prevent infinite crawling

  constructor(config: CrawlConfig) {
    this.config = config;
    this.urlQueue = new UrlQueue(config.url);
  }

  /**
   * Main crawl method
   */
  async crawl(): Promise<PageInfo[]> {
    try {
      await this.init();
      
      this.spinner.start('Crawling pages...');
      
      while (!this.urlQueue.isEmpty()) {
        const item = this.urlQueue.dequeue();
        if (!item) break;

        // Check depth limit
        if (item.depth > this.config.maxDepth) {
          logger.debug(`Skipping ${item.url} - max depth reached`);
          continue;
        }

        await this.crawlPage(item.url, item.depth);
        
        // Update spinner
        this.spinner.text = `Crawling... (${this.pages.length} pages found, ${this.urlQueue.size()} in queue)`;
        
        // Polite delay between requests
        await this.delay(this.config.delay);
      }
      
      this.spinner.succeed(`Crawl complete: ${this.pages.length} pages found`);
      
      return this.pages;
      
    } catch (error) {
      this.spinner.fail('Crawl failed');
      logger.error('Crawl error:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize browser
   */
  private async init(): Promise<void> {
    logger.info('Launching browser...');
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--disable-blink-features=AutomationControlled']
    });
  }

  /**
   * Crawl a single page
   */
  private async crawlPage(url: string, depth: number): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    let page: Page | null = null;
    
    try {
      page = await this.browser.newPage();
      
      // Set reasonable timeouts
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);
      
      // Navigate to page
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      if (!response) {
        throw new Error('No response received');
      }

      const statusCode = response.status();
      
      // Only process successful responses
      if (statusCode >= 200 && statusCode < 300) {
        // Get page info
        const title = await page.title();
        
        this.pages.push({
          url,
          depth,
          title,
          statusCode,
          timestamp: new Date()
        });

        this.urlQueue.markVisited(url);
        logger.info(`✓ Crawled: ${url} (${statusCode})`);

        // Extract links if not at max depth
        if (depth < this.config.maxDepth) {
          await this.extractLinks(page, url, depth);
        }
      } else {
        logger.warn(`Non-200 response for ${url}: ${statusCode}`);
        this.errors.push({
          url,
          error: `HTTP ${statusCode}`,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to crawl ${url}:`, errorMessage);
      this.errors.push({
        url,
        error: errorMessage,
        timestamp: new Date()
      });
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Extract links from a page
   */
  private async extractLinks(page: Page, currentUrl: string, currentDepth: number): Promise<void> {
    try {
      const content = await page.content();
      const $ = cheerio.load(content);
      
      // Find all links
      const links = $('a[href]')
        .map((_, el) => $(el).attr('href'))
        .get()
        .filter(Boolean);

      // Process each link
      for (const link of links) {
        try {
          // Resolve relative URLs
          const absoluteUrl = new URL(link, currentUrl).href;
          
          // Add to queue
          this.urlQueue.enqueue({
            url: absoluteUrl,
            depth: currentDepth + 1,
            parentUrl: currentUrl
          });
        } catch (error) {
          // Invalid URL, skip
          logger.debug(`Invalid link: ${link}`);
        }
      }
      
      logger.debug(`Extracted ${links.length} links from ${currentUrl}`);
      
    } catch (error) {
      logger.error(`Failed to extract links from ${currentUrl}:`, error);
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }

  /**
   * Get crawl errors
   */
  getErrors(): CrawlError[] {
    return this.errors;
  }
}
