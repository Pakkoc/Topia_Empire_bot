import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  MarketRepositoryPort,
  MarketListingFilter,
  MarketListing,
  MarketCategory,
  MarketStatus,
  RepositoryError,
} from '@topia/core';
import { Result } from '@topia/core';

// ========== Row Interface ==========

interface MarketListingRow extends RowDataPacket {
  id: string; // BIGINT
  guild_id: string;
  seller_id: string;
  title: string;
  description: string | null;
  category: MarketCategory;
  price: string; // BIGINT
  currency_type: 'topy' | 'ruby';
  status: MarketStatus;
  buyer_id: string | null;
  created_at: Date;
  expires_at: Date;
  sold_at: Date | null;
}

interface CountRow extends RowDataPacket {
  count: number;
}

// ========== Mapper ==========

function toMarketListing(row: MarketListingRow): MarketListing {
  return {
    id: BigInt(row.id),
    guildId: row.guild_id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description,
    category: row.category,
    price: BigInt(row.price),
    currencyType: row.currency_type,
    status: row.status,
    buyerId: row.buyer_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    soldAt: row.sold_at,
  };
}

// ========== Repository ==========

export class MarketRepository implements MarketRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findListings(
    guildId: string,
    filter?: MarketListingFilter
  ): Promise<Result<MarketListing[], RepositoryError>> {
    try {
      let query = `
        SELECT * FROM market_listings
        WHERE guild_id = ?
      `;
      const params: (string | number)[] = [guildId];

      if (filter?.status) {
        query += ' AND status = ?';
        params.push(filter.status);
      }

      if (filter?.category) {
        query += ' AND category = ?';
        params.push(filter.category);
      }

      if (filter?.currencyType) {
        query += ' AND currency_type = ?';
        params.push(filter.currencyType);
      }

      if (filter?.sellerId) {
        query += ' AND seller_id = ?';
        params.push(filter.sellerId);
      }

      query += ' ORDER BY created_at DESC';

      if (filter?.limit) {
        query += ' LIMIT ?';
        params.push(filter.limit);

        if (filter?.offset) {
          query += ' OFFSET ?';
          params.push(filter.offset);
        }
      }

      const [rows] = await this.pool.query<MarketListingRow[]>(query, params);
      return Result.ok(rows.map(toMarketListing));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findById(listingId: bigint): Promise<Result<MarketListing | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.query<MarketListingRow[]>(
        'SELECT * FROM market_listings WHERE id = ?',
        [listingId.toString()]
      );

      if (rows.length === 0) {
        return Result.ok(null);
      }

      return Result.ok(toMarketListing(rows[0]!));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async countActiveListingsBySeller(
    guildId: string,
    sellerId: string
  ): Promise<Result<number, RepositoryError>> {
    try {
      const [rows] = await this.pool.query<CountRow[]>(
        `SELECT COUNT(*) as count FROM market_listings
         WHERE guild_id = ? AND seller_id = ? AND status = 'active'`,
        [guildId, sellerId]
      );

      return Result.ok(rows[0]?.count ?? 0);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async save(listing: Omit<MarketListing, 'id'>): Promise<Result<MarketListing, RepositoryError>> {
    try {
      const [result] = await this.pool.query<ResultSetHeader>(
        `INSERT INTO market_listings
         (guild_id, seller_id, title, description, category, price, currency_type, status, buyer_id, created_at, expires_at, sold_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          listing.guildId,
          listing.sellerId,
          listing.title,
          listing.description,
          listing.category,
          listing.price.toString(),
          listing.currencyType,
          listing.status,
          listing.buyerId,
          listing.createdAt,
          listing.expiresAt,
          listing.soldAt,
        ]
      );

      return Result.ok({
        ...listing,
        id: BigInt(result.insertId),
      });
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateStatus(
    listingId: bigint,
    status: MarketStatus,
    buyerId?: string,
    soldAt?: Date
  ): Promise<Result<void, RepositoryError>> {
    try {
      if (status === 'sold' && buyerId && soldAt) {
        await this.pool.query(
          `UPDATE market_listings SET status = ?, buyer_id = ?, sold_at = ? WHERE id = ?`,
          [status, buyerId, soldAt, listingId.toString()]
        );
      } else {
        await this.pool.query(
          `UPDATE market_listings SET status = ? WHERE id = ?`,
          [status, listingId.toString()]
        );
      }

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async expireListings(now: Date): Promise<Result<number, RepositoryError>> {
    try {
      const [result] = await this.pool.query<ResultSetHeader>(
        `UPDATE market_listings SET status = 'expired'
         WHERE status = 'active' AND expires_at < ?`,
        [now]
      );

      return Result.ok(result.affectedRows);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findBySellerld(
    guildId: string,
    sellerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<MarketListing[], RepositoryError>> {
    try {
      let query = `
        SELECT * FROM market_listings
        WHERE guild_id = ? AND seller_id = ?
        ORDER BY created_at DESC
      `;
      const params: (string | number)[] = [guildId, sellerId];

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);

        if (options?.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      const [rows] = await this.pool.query<MarketListingRow[]>(query, params);
      return Result.ok(rows.map(toMarketListing));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findByBuyerId(
    guildId: string,
    buyerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<MarketListing[], RepositoryError>> {
    try {
      let query = `
        SELECT * FROM market_listings
        WHERE guild_id = ? AND buyer_id = ? AND status = 'sold'
        ORDER BY sold_at DESC
      `;
      const params: (string | number)[] = [guildId, buyerId];

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);

        if (options?.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      const [rows] = await this.pool.query<MarketListingRow[]>(query, params);
      return Result.ok(rows.map(toMarketListing));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async countActiveListings(
    guildId: string,
    filter?: { category?: MarketCategory; currencyType?: 'topy' | 'ruby' }
  ): Promise<Result<number, RepositoryError>> {
    try {
      let query = `
        SELECT COUNT(*) as count FROM market_listings
        WHERE guild_id = ? AND status = 'active'
      `;
      const params: string[] = [guildId];

      if (filter?.category) {
        query += ' AND category = ?';
        params.push(filter.category);
      }

      if (filter?.currencyType) {
        query += ' AND currency_type = ?';
        params.push(filter.currencyType);
      }

      const [rows] = await this.pool.query<CountRow[]>(query, params);
      return Result.ok(rows[0]?.count ?? 0);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
