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

export function joinAdjacentBlocks(blocks: Block[], index: number, direction: "previous" | "next"): Block[] {
  const peerIndex = direction === "previous" ? index - 1 : index + 1;
  if (index < 0 || index >= blocks.length || peerIndex < 0 || peerIndex >= blocks.length) return blocks;
  const source = blocks[index];
  const peer = blocks[peerIndex];
  const rowId = source.styles?.layout?.rowId || peer.styles?.layout?.rowId || `row-${source.id}`;

  const withRow = blocks.map((block, i) => {
    if (i !== index && i !== peerIndex) return block;
    return {
      ...block,
      styles: {
        ...(block.styles || {}),
        layout: {
          ...(block.styles?.layout || {}),
          rowId
        }
      }
    };
  });
  return normalizeRowLayout(withRow, rowId);
}

export function leaveRowForBlock(blocks: Block[], index: number): Block[] {
  if (index < 0 || index >= blocks.length) return blocks;
  const targetRowId = blocks[index]?.styles?.layout?.rowId;
  if (!targetRowId) return blocks;
  const withoutTarget = blocks.map((block, i) => {
    if (i !== index) return block;
    return {
      ...block,
      styles: {
        ...(block.styles || {}),
        layout: {
          ...(block.styles?.layout || {}),
          rowId: undefined,
          widthMode: "full",
          widthPercent: 100
        }
      }
    };
  });

  const remainingIndexes: number[] = [];
  withoutTarget.forEach((block, i) => {
    if (i !== index && block.styles?.layout?.rowId === targetRowId) remainingIndexes.push(i);
  });
  if (remainingIndexes.length <= 1) {
    return withoutTarget.map((block, i) => {
      if (!remainingIndexes.includes(i)) return block;
      return {
        ...block,
        styles: {
          ...(block.styles || {}),
          layout: {
            ...(block.styles?.layout || {}),
            rowId: undefined,
            widthMode: "full",
            widthPercent: 100
          }
        }
      };
    });
  }
  return normalizeRowLayout(withoutTarget, targetRowId);
}

function defaultRowWidths(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const widths = Array.from({ length: count }, () => base);
  let remainder = 100 - base * count;
  for (let i = count - 1; i >= 0 && remainder > 0; i -= 1) {
    widths[i] += 1;
    remainder -= 1;
  }
  return widths;
}

function normalizeRowLayout(blocks: Block[], rowId: string): Block[] {
  const indexes: number[] = [];
  const widths: number[] = [];
  blocks.forEach((block, i) => {
    if (block.styles?.layout?.rowId !== rowId) return;
    indexes.push(i);
    widths.push(block.styles?.layout?.widthPercent ?? NaN);
  });
  if (indexes.length <= 1) return blocks;

  const validWidths = widths.every((width) => Number.isFinite(width) && width > 0);
  const sum = widths.reduce((acc, width) => acc + (Number.isFinite(width) ? width : 0), 0);
  const keepExisting = validWidths && sum >= 99 && sum <= 101;
  const normalizedWidths = keepExisting ? widths : defaultRowWidths(indexes.length);

  return blocks.map((block, i) => {
    const idx = indexes.indexOf(i);
    if (idx === -1) return block;
    const widthPercent = normalizedWidths[idx] ?? 100;
    return {
      ...block,
      styles: {
        ...(block.styles || {}),
        layout: {
          ...(block.styles?.layout || {}),
          rowId,
          widthMode: widthPercent >= 100 ? "full" : "custom",
          widthPercent
        }
      }
    };
  });
}
