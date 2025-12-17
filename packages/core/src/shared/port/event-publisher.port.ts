/**
 * 이벤트 발행 Port - Redis Pub/Sub 등으로 구현
 */
export interface EventPublisherPort {
  publish(channel: string, event: unknown): Promise<void>;
}
