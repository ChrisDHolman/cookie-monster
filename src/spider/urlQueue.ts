import { UrlQueueItem } from './types';
import { logger } from '../utils/logger';

export class UrlQueue {
  private queue: UrlQueueItem[] = [];
  private visited: Set<string> = new Set();
  private baseDomain: string;

  constructor(startUrl: string) {
    this.baseDomain = new URL(startUrl).hostname;
    this.enqueue({ url: startUrl, depth: 0 });
  }

  /**
   * Add a URL to the queue if it hasn't been visited and is on the same domain
   */
  enqueue(item: UrlQueueItem): boolean {
    const normalizedUrl = this.normalizeUrl(item.url);
    
    // Check if already visited
    if (this.visited.has(normalizedUrl)) {
      return false;
    }

    // Check if same domain
    try {
      const urlObj = new URL(normalizedUrl);
      if (urlObj.hostname !== this.baseDomain) {
        logger.debug(`Skipping external URL: ${normalizedUrl}`);
        return false;
      }
    } catch (error) {
      logger.warn(`Invalid URL: ${item.url}`);
      return false;
    }

    // Check for common non-page resources
    if (this.isResourceUrl(normalizedUrl)) {
      return false;
    }

    this.queue.push({ ...item, url: normalizedUrl });
    logger.debug(`Enqueued: ${normalizedUrl} (depth: ${item.depth})`);
    return true;
  }

  /**
   * Get next URL from queue
   */
  dequeue(): UrlQueueItem | undefined {
    return this.queue.shift();
  }

  /**
   * Mark a URL as visited
   */
  markVisited(url: string): void {
    this.visited.add(this.normalizeUrl(url));
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get number of visited URLs
   */
  visitedCount(): number {
    return this.visited.size;
  }

  /**
   * Normalize URL for comparison (remove fragments, trailing slashes, etc.)
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove fragment
      urlObj.hash = '';
      // Remove trailing slash from pathname (except for root)
      if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }
      // Sort query parameters for consistency
      urlObj.searchParams.sort();
      return urlObj.href;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL is a resource file (not a page)
   */
  private isResourceUrl(url: string): boolean {
    const resourceExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
      '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mp3', '.avi',
      '.css', '.js', '.woff', '.woff2', '.ttf', '.eot',
      '.xml', '.txt', '.json', '.rss', '.feed'
    ];
    
    const urlLower = url.toLowerCase();
    
    // Skip resource files
    if (resourceExtensions.some(ext => urlLower.endsWith(ext))) {
      return true;
    }
    
    // Skip common non-page patterns
    const skipPatterns = [
      '/feed/', '/rss/', '/wp-json/', '/api/',
      '?replytocom=', '?share=', '?print=',
      '/tag/', '/author/', '/category/',
      '/page/', '/?p=', '/?page_id='
    ];
    
    return skipPatterns.some(pattern => urlLower.includes(pattern));
  }

  /**
   * Get all visited URLs
   */
  getVisited(): string[] {
    return Array.from(this.visited);
  }
}
