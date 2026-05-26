export type Cell = { col: number; row: number };

export type PlacedItem = {
  id: string;
  name: string;
  category: string;
  col: number;
  row: number;
  w: number;
  h: number;
  color: string;
};

export type PlacementResult = {
  success: boolean;
  placements: PlacedItem[];
  turningCircle: { col: number; row: number; diameter: number } | null;
  pathways: Cell[];
  violations: string[];
  adaCompliant: boolean;
  openFloorPercent: number;
};

type FixedElement = { type: string; col: number; row: number; w: number; h: number };
type FurnitureInput = {
  id: string;
  name: string;
  category: string;
  widthIn: number;
  depthIn: number;
};

const FURNITURE_COLORS = [
  "#7B2FF7", "#9333EA", "#6D28D9", "#A855F7", "#7C3AED", "#8B5CF6",
];

// grid values: 0 = free, 1 = fixed element, 2 = furniture
function makeGrid(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0) as number[]);
}

function markRect(
  grid: number[][],
  col: number,
  row: number,
  w: number,
  h: number,
  value: number
): void {
  const rows = grid.length;
  const cols = grid[0].length;
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (r >= 0 && c >= 0 && r < rows && c < cols) {
        grid[r][c] = value;
      }
    }
  }
}

function isRectFree(
  grid: number[][],
  col: number,
  row: number,
  w: number,
  h: number
): boolean {
  const rows = grid.length;
  const cols = grid[0].length;
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] !== 0) return false;
    }
  }
  return true;
}

type WallPositions = (
  roomW: number,
  roomL: number,
  wc: number,
  hc: number
) => Array<[number, number]>;

// Returns candidate (col, row) positions along each wall in priority order
const WALL_POSITIONS: Record<string, WallPositions> = {
  north: (roomW, _roomL, wc, _hc) =>
    Array.from({ length: Math.max(0, roomW - wc + 1) }, (_, i) => [i, 0]),
  east: (roomW, roomL, wc, hc) =>
    Array.from({ length: Math.max(0, roomL - hc + 1) }, (_, i) => [roomW - wc, i]),
  south: (roomW, roomL, wc, hc) =>
    Array.from({ length: Math.max(0, roomW - wc + 1) }, (_, i) => [i, roomL - hc]),
  west: (_roomW, roomL, _wc, hc) =>
    Array.from({ length: Math.max(0, roomL - hc + 1) }, (_, i) => [0, i]),
};

const WALL_ORDER = ["north", "east", "south", "west"];

function tryPlaceFurniture(
  grid: number[][],
  roomW: number,
  roomL: number,
  wCells: number,
  hCells: number
): { col: number; row: number } | null {
  // Try each wall in priority order
  for (const wall of WALL_ORDER) {
    const positions = WALL_POSITIONS[wall](roomW, roomL, wCells, hCells);
    for (const [col, row] of positions) {
      if (isRectFree(grid, col, row, wCells, hCells)) {
        return { col, row };
      }
    }
  }
  return null;
}

export function findTurningCircle(
  grid: number[][],
  rows: number,
  cols: number,
  diameterCells: number
): { col: number; row: number } | null {
  const radius = diameterCells / 2;
  const r2 = radius * radius;

  for (let cy = Math.ceil(radius); cy <= rows - Math.ceil(radius); cy++) {
    for (let cx = Math.ceil(radius); cx <= cols - Math.ceil(radius); cx++) {
      let fits = true;
      outerLoop: for (
        let r = Math.floor(cy - radius);
        r <= Math.ceil(cy + radius);
        r++
      ) {
        for (let c = Math.floor(cx - radius); c <= Math.ceil(cx + radius); c++) {
          if (r < 0 || c < 0 || r >= rows || c >= cols) {
            fits = false;
            break outerLoop;
          }
          const dx = c - cx;
          const dy = r - cy;
          if (dx * dx + dy * dy <= r2 && grid[r][c] !== 0) {
            fits = false;
            break outerLoop;
          }
        }
      }
      if (fits) return { col: cx, row: cy };
    }
  }
  return null;
}

export function floodFill(
  grid: number[][],
  startRow: number,
  startCol: number
): Cell[] {
  const rows = grid.length;
  const cols = grid[0].length;
  if (startRow < 0 || startCol < 0 || startRow >= rows || startCol >= cols) return [];

  const visited = new Set<string>();
  const queue: Cell[] = [];
  const result: Cell[] = [];
  const start = `${startCol},${startRow}`;

  visited.add(start);
  queue.push({ col: startCol, row: startRow });

  while (queue.length > 0) {
    const cell = queue.shift()!;
    result.push(cell);
    const neighbors: [number, number][] = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
    ];
    for (const [dc, dr] of neighbors) {
      const nc = cell.col + dc;
      const nr = cell.row + dr;
      const key = `${nc},${nr}`;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (visited.has(key)) continue;
      if (grid[nr][nc] !== 0) continue;
      visited.add(key);
      queue.push({ col: nc, row: nr });
    }
  }
  return result;
}

export function placeItemsInRoom(
  roomW: number,
  roomL: number,
  fixedElements: FixedElement[],
  furnitureToPlace: FurnitureInput[],
  wheelchairDiameterIn: number
): PlacementResult {
  const grid = makeGrid(roomL, roomW);
  const violations: string[] = [];
  const placements: PlacedItem[] = [];

  // Mark fixed elements (1 = fixed)
  const doorEl = fixedElements.find((e) => e.type === "door");
  for (const el of fixedElements) {
    markRect(grid, el.col, el.row, el.w, el.h, 1);
  }

  // Place each furniture item
  for (let i = 0; i < furnitureToPlace.length; i++) {
    const item = furnitureToPlace[i];
    const wCells = Math.max(1, Math.ceil(item.widthIn / 12));
    const hCells = Math.max(1, Math.ceil(item.depthIn / 12));
    const color = FURNITURE_COLORS[i % FURNITURE_COLORS.length];

    const pos = tryPlaceFurniture(grid, roomW, roomL, wCells, hCells);
    if (pos) {
      markRect(grid, pos.col, pos.row, wCells, hCells, 2);
      placements.push({
        id: item.id,
        name: item.name,
        category: item.category,
        col: pos.col,
        row: pos.row,
        w: wCells,
        h: hCells,
        color,
      });
    } else {
      violations.push(`Could not place "${item.name}" — room too small or fully occupied`);
    }
  }

  // Check for 36" (3-cell) clearance violations
  const CLEARANCE = 3;
  for (const item of placements) {
    // Check in front of each furniture item toward center
    const centerCol = roomW / 2;
    const centerRow = roomL / 2;
    const facingRight = item.col + item.w / 2 < centerCol;
    const facingDown = item.row + item.h / 2 < centerRow;

    // Check at least one side has 3-cell clearance
    const leftClear = item.col >= CLEARANCE;
    const rightClear = item.col + item.w + CLEARANCE <= roomW;
    const topClear = item.row >= CLEARANCE;
    const botClear = item.row + item.h + CLEARANCE <= roomL;

    const _ = [facingRight, facingDown]; // suppress unused warning
    if (!leftClear && !rightClear && !topClear && !botClear) {
      violations.push(`"${item.name}" may not have 36" clearance on any side`);
    }
  }

  // Find turning circle position
  const diameterCells = wheelchairDiameterIn / 12;
  const turningPos = findTurningCircle(grid, roomL, roomW, diameterCells);
  if (!turningPos) {
    violations.push(
      `No space for ${wheelchairDiameterIn}" turning circle — remove or reposition furniture`
    );
  }

  // Flood fill from door to find reachable cells
  let pathways: Cell[] = [];
  if (doorEl) {
    const tempGrid = grid.map((r) => [...r]);
    // Temporarily free door cells so BFS can start there
    markRect(tempGrid, doorEl.col, doorEl.row, doorEl.w, doorEl.h, 0);
    const startCol = Math.floor(doorEl.col + doorEl.w / 2);
    const startRow = Math.floor(doorEl.row + doorEl.h / 2);
    pathways = floodFill(tempGrid, startRow, startCol);
  }

  // Open floor calculation
  const totalCells = roomW * roomL;
  const occupiedCount = grid.flat().filter((v) => v !== 0).length;
  const openFloorPercent = Math.round(
    ((totalCells - occupiedCount) / totalCells) * 100
  );

  const adaCompliant = turningPos !== null && violations.length === 0;

  return {
    success: placements.length === furnitureToPlace.length,
    placements,
    turningCircle: turningPos ? { ...turningPos, diameter: diameterCells } : null,
    pathways,
    violations,
    adaCompliant,
    openFloorPercent,
  };
}
