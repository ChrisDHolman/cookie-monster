import { UrlQueue } from '../../src/spider/urlQueue';

describe('UrlQueue', () => {
  let queue: UrlQueue;
  const baseUrl = 'https://example.com';

  beforeEach(() => {
    queue = new UrlQueue(baseUrl);
  });

  describe('constructor', () => {
    it('should initialize with start URL in queue', () => {
      expect(queue.size()).toBe(1);
      expect(queue.isEmpty()).toBe(false);
    });

    it('should extract and store base domain', () => {
      const item = queue.dequeue();
      // Base URL gets normalized with trailing slash
      expect(item?.url).toBe('https://example.com/');
      expect(item?.depth).toBe(0);
    });
  });

  describe('enqueue', () => {
    it('should add valid same-domain URL to queue', () => {
      const result = queue.enqueue({ url: 'https://example.com/page1', depth: 1 });
      expect(result).toBe(true);
      expect(queue.size()).toBe(2);
    });

    it('should reject URLs from different domain', () => {
      const result = queue.enqueue({ url: 'https://different.com/page', depth: 1 });
      expect(result).toBe(false);
      expect(queue.size()).toBe(1);
    });

    it('should reject already visited URLs', () => {
      const url = 'https://example.com/page1';
      queue.enqueue({ url, depth: 1 });
      queue.markVisited(url);

      const result = queue.enqueue({ url, depth: 1 });
      expect(result).toBe(false);
    });

    it('should allow duplicate URLs in queue if not visited', () => {
      const url = 'https://example.com/page1';
      const first = queue.enqueue({ url, depth: 1 });
      const second = queue.enqueue({ url, depth: 1 });

      // Implementation allows duplicates in queue, only checks visited set
      expect(first).toBe(true);
      expect(second).toBe(true);
      expect(queue.size()).toBe(3); // base URL + page1 + page1
    });

    it('should normalize URLs with trailing slashes', () => {
      queue.enqueue({ url: 'https://example.com/page1/', depth: 1 });
      queue.markVisited('https://example.com/page1/');
      const result = queue.enqueue({ url: 'https://example.com/page1', depth: 1 });

      // After marking as visited, normalized versions should be rejected
      expect(result).toBe(false);
    });

    it('should normalize URLs by removing fragments', () => {
      queue.enqueue({ url: 'https://example.com/page1#section', depth: 1 });
      queue.markVisited('https://example.com/page1#section');
      const result = queue.enqueue({ url: 'https://example.com/page1#different', depth: 1 });

      // Different fragments normalize to same URL, should be rejected when visited
      expect(result).toBe(false);
    });

    it('should normalize URLs by sorting query parameters', () => {
      queue.enqueue({ url: 'https://example.com/page?b=2&a=1', depth: 1 });
      queue.markVisited('https://example.com/page?b=2&a=1');
      const result = queue.enqueue({ url: 'https://example.com/page?a=1&b=2', depth: 1 });

      // Different query param order normalizes to same URL
      expect(result).toBe(false);
    });

    it('should reject resource URLs with common extensions', () => {
      const resourceUrls = [
        'https://example.com/image.jpg',
        'https://example.com/style.css',
        'https://example.com/script.js',
        'https://example.com/doc.pdf',
        'https://example.com/font.woff2',
      ];

      resourceUrls.forEach(url => {
        const result = queue.enqueue({ url, depth: 1 });
        expect(result).toBe(false);
      });
    });

    it('should reject URLs with skip patterns', () => {
      // Test specific patterns that are definitely filtered
      const result1 = queue.enqueue({ url: 'https://example.com/wp-json/endpoint', depth: 1 });
      const result2 = queue.enqueue({ url: 'https://example.com/page?replytocom=123', depth: 1 });

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      const result = queue.enqueue({ url: 'not-a-valid-url', depth: 1 });
      expect(result).toBe(false);
    });

    it('should preserve depth value when enqueuing', () => {
      queue.enqueue({ url: 'https://example.com/page1', depth: 3 });
      queue.dequeue(); // Remove base URL
      const item = queue.dequeue();

      expect(item?.depth).toBe(3);
    });
  });

  describe('dequeue', () => {
    it('should return and remove first item from queue', () => {
      const url = 'https://example.com/page1';
      queue.enqueue({ url, depth: 1 });

      const initialSize = queue.size();
      const item = queue.dequeue();

      expect(item).toBeDefined();
      expect(queue.size()).toBe(initialSize - 1);
    });

    it('should return undefined when queue is empty', () => {
      queue.dequeue(); // Remove base URL
      const item = queue.dequeue();

      expect(item).toBeUndefined();
    });

    it('should maintain FIFO order', () => {
      queue.enqueue({ url: 'https://example.com/page1', depth: 1 });
      queue.enqueue({ url: 'https://example.com/page2', depth: 1 });

      const first = queue.dequeue();
      const second = queue.dequeue();
      const third = queue.dequeue();

      expect(first?.url).toBe('https://example.com/');
      expect(second?.url).toBe('https://example.com/page1');
      expect(third?.url).toBe('https://example.com/page2');
    });
  });

  describe('markVisited', () => {
    it('should mark URL as visited', () => {
      const url = 'https://example.com/page1';
      queue.markVisited(url);

      expect(queue.visitedCount()).toBe(1);
    });

    it('should prevent visited URLs from being enqueued', () => {
      const url = 'https://example.com/page1';
      queue.markVisited(url);

      const result = queue.enqueue({ url, depth: 1 });
      expect(result).toBe(false);
    });

    it('should normalize URL before marking as visited', () => {
      queue.markVisited('https://example.com/page1/');

      const result = queue.enqueue({ url: 'https://example.com/page1', depth: 1 });
      expect(result).toBe(false);
    });
  });

  describe('isEmpty', () => {
    it('should return false when queue has items', () => {
      expect(queue.isEmpty()).toBe(false);
    });

    it('should return true when queue is empty', () => {
      queue.dequeue();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('size', () => {
    it('should return correct queue size', () => {
      expect(queue.size()).toBe(1);

      queue.enqueue({ url: 'https://example.com/page1', depth: 1 });
      expect(queue.size()).toBe(2);

      queue.dequeue();
      expect(queue.size()).toBe(1);
    });

    it('should return 0 for empty queue', () => {
      queue.dequeue();
      expect(queue.size()).toBe(0);
    });
  });

  describe('visitedCount', () => {
    it('should return correct visited count', () => {
      expect(queue.visitedCount()).toBe(0);

      queue.markVisited('https://example.com/page1');
      expect(queue.visitedCount()).toBe(1);

      queue.markVisited('https://example.com/page2');
      expect(queue.visitedCount()).toBe(2);
    });

    it('should not increment for duplicate visited URLs', () => {
      const url = 'https://example.com/page1';
      queue.markVisited(url);
      queue.markVisited(url);

      expect(queue.visitedCount()).toBe(1);
    });
  });

  describe('getVisited', () => {
    it('should return array of visited URLs', () => {
      queue.markVisited('https://example.com/page1');
      queue.markVisited('https://example.com/page2');

      const visited = queue.getVisited();
      expect(visited).toHaveLength(2);
      expect(visited).toContain('https://example.com/page1');
      expect(visited).toContain('https://example.com/page2');
    });

    it('should return empty array when no URLs visited', () => {
      const visited = queue.getVisited();
      expect(visited).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle URLs with different protocols', () => {
      const httpQueue = new UrlQueue('http://example.com');
      const result = httpQueue.enqueue({ url: 'http://example.com/page1', depth: 1 });

      // Should accept same protocol
      expect(result).toBe(true);
    });

    it('should handle URLs with subdomains', () => {
      const subdomainUrl = 'https://sub.example.com/page1';
      const result = queue.enqueue({ url: subdomainUrl, depth: 1 });

      // Should reject because subdomain doesn't match
      expect(result).toBe(false);
    });

    it('should handle root path correctly', () => {
      const rootUrl = 'https://example.com/';
      queue.markVisited(baseUrl); // Mark base URL as visited
      const result = queue.enqueue({ url: rootUrl, depth: 1 });

      // Should reject as duplicate of base URL after visited
      expect(result).toBe(false);
    });

    it('should handle deep URLs', () => {
      const deepUrl = 'https://example.com/path/to/deep/page';
      const result = queue.enqueue({ url: deepUrl, depth: 1 });

      expect(result).toBe(true);
    });

    it('should handle URLs with ports', () => {
      const queueWithPort = new UrlQueue('https://example.com:8080');
      const result = queueWithPort.enqueue({
        url: 'https://example.com:8080/page1',
        depth: 1
      });

      expect(result).toBe(true);
    });
  });
});
