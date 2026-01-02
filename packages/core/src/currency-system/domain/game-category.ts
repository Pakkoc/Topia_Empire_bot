/**
 * 내전 카테고리 엔티티
 */
export interface GameCategory {
  id: number;
  guildId: string;
  name: string;
  teamCount: number;
  enabled: boolean;
  createdAt: Date;
}

/**
 * 카테고리 생성 DTO
 */
export interface CreateCategoryDto {
  guildId: string;
  name: string;
  teamCount: number;
}

/**
 * 카테고리 업데이트 DTO
 */
export interface UpdateCategoryDto {
  name?: string;
  teamCount?: number;
  enabled?: boolean;
}
