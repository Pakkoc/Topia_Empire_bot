import { myInfoCommand } from './my-info';
import { attendanceCommand } from './attendance';
import { transferCommand } from './transfer';
import { shopCommand } from './shop';
import type { Command } from './types';

export const commands: Command[] = [
  myInfoCommand,
  attendanceCommand,
  transferCommand,
  shopCommand,
];

export type { Command } from './types';
