import { myInfoCommand } from './my-info';
import { attendanceCommand } from './attendance';
import { transferCommand } from './transfer';
import { grantCommand } from './grant';
import { inventoryCommand } from './inventory';
import type { Command } from './types';

export const commands: Command[] = [
  myInfoCommand,
  attendanceCommand,
  transferCommand,
  grantCommand,
  inventoryCommand,
];

export type { Command } from './types';
