import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the database module
vi.mock('@/lib/db', () => ({
  getPool: vi.fn(),
}));

// Import after mocking
import { getPool } from '@/lib/db';
import { GET, POST } from '../hall-of-fame/route';

const mockGetPool = vi.mocked(getPool);

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/game/hall-of-fame', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Hall of Fame API', () => {
  let mockRequest: ReturnType<typeof vi.fn>;
  let mockQuery: ReturnType<typeof vi.fn>;
  let mockInput: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockQuery = vi.fn().mockResolvedValue({ recordset: [] });
    mockInput = vi.fn().mockReturnThis();
    mockRequest = vi.fn().mockReturnValue({ query: mockQuery, input: mockInput });
    mockGetPool.mockResolvedValue({ request: mockRequest } as unknown as ReturnType<typeof getPool> extends Promise<infer T> ? T : never);
  });

  describe('GET', () => {
    it('returns an array', async () => {
      const response = await GET();
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns winners from DB', async () => {
      mockQuery.mockResolvedValue({
        recordset: [{ name: 'Test', wonAt: '2026-01-01', attemptCount: 5 }],
      });
      const response = await GET();
      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Test');
    });
  });

  describe('POST', () => {
    it('returns 201 for valid input', async () => {
      const req = createRequest({ name: 'Winner', attemptCount: 5 });
      const response = await POST(req);
      expect(response.status).toBe(201);
    });

    it('returns 400 for empty name', async () => {
      const req = createRequest({ name: '', attemptCount: 5 });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 for name over 50 chars', async () => {
      const req = createRequest({ name: 'A'.repeat(51), attemptCount: 5 });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 for non-string name', async () => {
      const req = createRequest({ name: 123, attemptCount: 5 });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 for missing attemptCount', async () => {
      const req = createRequest({ name: 'Winner' });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 for attemptCount outside range', async () => {
      const req = createRequest({ name: 'Winner', attemptCount: 200 });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('uses parameterized queries', async () => {
      const req = createRequest({ name: 'Winner', attemptCount: 5 });
      await POST(req);
      expect(mockInput).toHaveBeenCalledWith('name', 'Winner');
      expect(mockInput).toHaveBeenCalledWith('attemptCount', 5);
    });
  });
});
