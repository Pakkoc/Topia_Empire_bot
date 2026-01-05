import { myInfoCommand } from './my-info';
import { attendanceCommand } from './attendance';
import { transferCommand } from './transfer';
import { grantCommand } from './grant';
import { deductCommand } from './deduct';
import { inventoryCommand } from './inventory';
import { vaultCommand } from './vault';
import { itemGiveCommand } from './item-give';
import { itemTakeCommand } from './item-take';
import type { Command } from './types';

export const commands: Command[] = [
  myInfoCommand,
  attendanceCommand,
  transferCommand,
  grantCommand,
  deductCommand,
  inventoryCommand,
  vaultCommand,
  itemGiveCommand,
  itemTakeCommand,
];

export type { Command } from './types';
