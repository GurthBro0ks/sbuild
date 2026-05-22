import type { Block, BlockLayout } from "./types.js";

export type RowGroup = { rowId: string; blocks: Block[] };

export function groupBlocksIntoRows(blocks: Block[]): RowGroup[] {
  const rows: RowGroup[] = [];
  for (const block of blocks) {
    const rowId = block.styles?.layout?.rowId || `single:${block.id}`;
    const prev = rows[rows.length - 1];
    if (prev && prev.rowId === rowId) prev.blocks.push(block);
    else rows.push({ rowId, blocks: [block] });
  }
  return rows;
}

export function clampWidthPercent(value: number): number {
  return Math.max(25, Math.min(100, value));
}

export function clampMinHeight(value: number): number {
  return Math.max(120, Math.min(640, value));
}

export function snapWidthPercent(value: number): number {
  const steps = [25, 33, 50, 66, 75, 100];
  return steps.reduce((best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best), steps[0]);
}

export function snapMinHeight(value: number): number {
  const steps = [120, 180, 240, 320, 480];
  return steps.reduce((best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best), steps[0]);
}

export function withLayout(block: Block, patch: Partial<BlockLayout>): Block {
  return { ...block, styles: { ...(block.styles || {}), layout: { ...(block.styles?.layout || {}), ...patch } } };
}

export function joinWithPrevious(blocks: Block[], index: number): string | undefined {
  if (index <= 0 || index >= blocks.length) return undefined;
  return blocks[index - 1].styles?.layout?.rowId || `row-${blocks[index - 1].id}`;
}

export function joinWithNext(blocks: Block[], index: number): string | undefined {
  if (index < 0 || index >= blocks.length - 1) return undefined;
  return blocks[index + 1].styles?.layout?.rowId || `row-${blocks[index + 1].id}`;
}
