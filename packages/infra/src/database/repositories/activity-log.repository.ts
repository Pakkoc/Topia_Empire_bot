import type { Pool } from 'mysql2/promise';

export type ActivityType = 'text' | 'voice';

export interface ActivityLogRepositoryPort {
  logActivity(guildId: string, userId: string, activityType: ActivityType): Promise<void>;
  cleanupOldLogs(days: number): Promise<number>;
}

export class ActivityLogRepository implements ActivityLogRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async logActivity(guildId: string, userId: string, activityType: ActivityType): Promise<void> {
    try {
      await this.pool.execute(
        `INSERT INTO activity_logs (guild_id, user_id, activity_type, activity_time)
         VALUES (?, ?, ?, NOW())`,
        [guildId, userId, activityType]
      );
    } catch (error) {
      // 로깅 실패는 XP 기능에 영향을 주지 않도록 조용히 처리
      console.error('[ACTIVITY LOG] Failed to log activity:', error);
    }
  }

  async cleanupOldLogs(days: number): Promise<number> {
    try {
      const [result] = await this.pool.execute(
        `DELETE FROM activity_logs WHERE activity_time < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days]
      );
      const deleted = (result as { affectedRows: number }).affectedRows;
      console.log(`[ACTIVITY LOG] Cleaned up ${deleted} old log entries`);
      return deleted;
    } catch (error) {
      console.error('[ACTIVITY LOG] Failed to cleanup old logs:', error);
      return 0;
    }
  }
}
