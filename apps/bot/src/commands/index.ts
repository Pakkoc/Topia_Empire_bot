import { myInfoCommand } from './my-info';
import { attendanceCommand } from './attendance';
import { transferCommand } from './transfer';
import { shopCommand } from './shop';
import { inventoryCommand } from './inventory';
import type { Command } from './types';

export const commands: Command[] = [
  myInfoCommand,
  attendanceCommand,
  transferCommand,
  shopCommand,
  inventoryCommand,
];

export type { Command } from './types';
