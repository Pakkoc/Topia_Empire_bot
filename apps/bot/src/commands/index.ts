import { myInfoCommand } from './my-info';
import { attendanceCommand } from './attendance';
import { transferCommand } from './transfer';
import { shopCommand } from './shop';
import { marketCommand } from './market';
import type { Command } from './types';

export const commands: Command[] = [
  myInfoCommand,
  attendanceCommand,
  transferCommand,
  shopCommand,
  marketCommand,
];

export type { Command } from './types';
