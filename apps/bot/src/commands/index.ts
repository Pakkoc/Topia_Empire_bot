import { myInfoCommand } from './my-info';
import { attendanceCommand } from './attendance';
import { transferCommand } from './transfer';
import { shopCommand } from './shop';
import { colorChangeCommand } from './color-change';
import type { Command } from './types';

export const commands: Command[] = [
  myInfoCommand,
  attendanceCommand,
  transferCommand,
  shopCommand,
  colorChangeCommand,
];

export type { Command } from './types';
