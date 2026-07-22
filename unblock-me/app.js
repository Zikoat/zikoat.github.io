// src/game.ts
function blockCells(block) {
  return Array.from({ length: block.length }, (_, offset) => ({
    x: block.x + (block.axis === "horizontal" ? offset : 0),
    y: block.y + (block.axis === "vertical" ? offset : 0)
  }));
}
function applyMove(state, action) {
  if (state.won)
    return reject(state, "already-won", "The puzzle is already won.");
  const block = state.blocks.find((candidate) => candidate.id.toLowerCase() === action.blockId.toLowerCase());
  if (!block)
    return reject(state, "unknown-block", `Unknown block: ${action.blockId}.`);
  const movesHorizontally = action.direction === "left" || action.direction === "right";
  if (block.axis === "horizontal" !== movesHorizontally) {
    return reject(state, "wrong-axis", `Block ${block.id} cannot move ${action.direction}.`);
  }
  const delta = directionDelta(action.direction);
  const movedBlock = { ...block, x: block.x + delta.x, y: block.y + delta.y };
  const movedCells = blockCells(movedBlock);
  if (movedCells.some((cell) => !isInBounds(state, cell))) {
    return reject(state, "out-of-bounds", `Block ${block.id} would leave the board.`);
  }
  const wallCells = new Set(state.walls.map(pointKey));
  if (movedCells.some((cell) => wallCells.has(pointKey(cell)))) {
    return reject(state, "blocked", `Block ${block.id} is blocked by a Wall.`);
  }
  const occupiedByOtherBlocks = new Set(state.blocks.filter((candidate) => candidate !== block).flatMap(blockCells).map(pointKey));
  if (movedCells.some((cell) => occupiedByOtherBlocks.has(pointKey(cell)))) {
    return reject(state, "blocked", `Block ${block.id} is blocked by another block.`);
  }
  const blocks = state.blocks.map((candidate) => candidate === block ? movedBlock : candidate);
  const checkpointCells = new Set(state.checkpoint.map(pointKey));
  const redBlock = blocks.find((candidate) => candidate.id.toLowerCase() === "r");
  const won = redBlock !== undefined && blockCells(redBlock).every((cell) => checkpointCells.has(pointKey(cell)));
  return { ok: true, state: { ...state, blocks, moves: state.moves + 1, won } };
}
function isInBounds(state, point) {
  return point.x >= 0 && point.x < state.width && point.y >= 0 && point.y < state.height;
}
function pointKey(point) {
  return `${point.x},${point.y}`;
}
function directionDelta(direction) {
  switch (direction) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
  }
}
function reject(state, code, message) {
  return { ok: false, state, code, message };
}

// src/puzzle.ts
var corridorWalls = [
  { x: 5, y: 0 },
  { x: 6, y: 0 },
  { x: 5, y: 1 },
  { x: 6, y: 1 },
  { x: 5, y: 3 },
  { x: 6, y: 3 },
  { x: 5, y: 4 },
  { x: 6, y: 4 }
];
function createPuzzle() {
  return {
    width: 7,
    height: 5,
    blocks: [
      { id: "R", axis: "horizontal", length: 2, x: 0, y: 2 },
      { id: "A", axis: "vertical", length: 2, x: 2, y: 1 },
      { id: "B", axis: "vertical", length: 2, x: 4, y: 2 }
    ],
    walls: corridorWalls.map((wall) => ({ ...wall })),
    checkpoint: [
      { x: 5, y: 2 },
      { x: 6, y: 2 }
    ],
    moves: 0,
    won: false
  };
}

// src/generator.ts
var baseSolution = [
  { blockId: "A", direction: "up" },
  { blockId: "B", direction: "down" },
  { blockId: "R", direction: "right" },
  { blockId: "R", direction: "right" },
  { blockId: "R", direction: "right" },
  { blockId: "R", direction: "right" },
  { blockId: "R", direction: "right" }
];
var directions = ["left", "right", "up", "down"];
function createGeneratedLevel(seed) {
  const random = mulberry32(seed);
  let state = createPuzzle();
  const scramble = [];
  const seen = new Set([fingerprint(state)]);
  for (let attempt = 0;attempt < 160 && scramble.length < 12; attempt += 1) {
    const actions = state.blocks.flatMap((block) => directions.map((direction) => ({ blockId: block.id, direction })));
    const action = actions[Math.floor(random() * actions.length)];
    const result = applyMove(state, action);
    if (!result.ok || result.state.won || seen.has(fingerprint(result.state)))
      continue;
    state = result.state;
    scramble.push(action);
    seen.add(fingerprint(state));
  }
  if (scramble.length < 3)
    throw new Error("Unable to generate a sufficiently scrambled level.");
  return {
    seed,
    state: resetMoveCount(state),
    solution: [...scramble].reverse().map(invert).concat(baseSolution)
  };
}
function cloneState(state) {
  return {
    ...state,
    blocks: state.blocks.map((block) => ({ ...block })),
    walls: state.walls.map((wall) => ({ ...wall })),
    checkpoint: state.checkpoint.map((cell) => ({ ...cell }))
  };
}
function resetMoveCount(state) {
  return { ...cloneState(state), moves: 0, won: false };
}
function invert(action) {
  const opposite = { left: "right", right: "left", up: "down", down: "up" };
  return { blockId: action.blockId, direction: opposite[action.direction] };
}
function fingerprint(state) {
  return state.blocks.map((block) => `${block.id}:${block.x},${block.y}`).join("|");
}
function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 1831565813;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

// src/web/client.ts
var board = document.querySelector("#board");
var moves = document.querySelector("#moves");
var seed = document.querySelector("#seed");
var status = document.querySelector("#status");
var win = document.querySelector("#win");
var initialState = createPuzzle();
var state = cloneState(initialState);
var currentSeed;
function render() {
  board.replaceChildren();
  for (let y = 0;y < state.height; y += 1) {
    for (let x = 0;x < state.width; x += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (state.checkpoint.some((point) => point.x === x && point.y === y))
        cell.classList.add("checkpoint");
      if (state.walls.some((point) => point.x === x && point.y === y))
        cell.classList.add("wall");
      board.append(cell);
    }
  }
  for (const block of state.blocks)
    board.append(createBlock(block));
  moves.textContent = `${state.moves} move${state.moves === 1 ? "" : "s"}`;
  seed.textContent = currentSeed === undefined ? "Fixed level" : `Seed ${currentSeed}`;
  win.classList.toggle("visible", state.won);
}
function createBlock(block) {
  const element = document.createElement("button");
  element.className = "block";
  element.dataset.blockId = block.id;
  element.ariaLabel = `${block.id} block`;
  element.textContent = block.id === "R" ? "RED" : block.id;
  element.style.gridColumn = `${block.x + 1} / span ${block.axis === "horizontal" ? block.length : 1}`;
  element.style.gridRow = `${block.y + 1} / span ${block.axis === "vertical" ? block.length : 1}`;
  attachDrag(element, block);
  return element;
}
function attachDrag(element, block) {
  let start;
  element.addEventListener("pointerdown", (event) => {
    if (state.won)
      return;
    start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointerup", (event) => {
    if (!start || start.pointerId !== event.pointerId)
      return;
    const direction = directionFromDrag(block.axis, event.clientX - start.x, event.clientY - start.y);
    start = undefined;
    if (!direction) {
      status.textContent = "Drag farther along the block's axis.";
      return;
    }
    const result = applyMove(state, { blockId: block.id, direction });
    if (!result.ok) {
      status.textContent = result.message;
      return;
    }
    state = result.state;
    status.textContent = result.state.won ? "Checkpoint reached." : `${block.id} moved ${direction}.`;
    render();
  });
  element.addEventListener("pointercancel", () => {
    start = undefined;
  });
}
function directionFromDrag(axis, dx, dy) {
  const threshold = 18;
  if (axis === "horizontal" && Math.abs(dx) >= threshold && Math.abs(dx) >= Math.abs(dy))
    return dx < 0 ? "left" : "right";
  if (axis === "vertical" && Math.abs(dy) >= threshold && Math.abs(dy) >= Math.abs(dx))
    return dy < 0 ? "up" : "down";
  return;
}
document.querySelector("[data-action='new-level']").addEventListener("pointerup", () => {
  currentSeed = Math.floor(Math.random() * 4000000000) + 1;
  const level = createGeneratedLevel(currentSeed);
  initialState = level.state;
  state = cloneState(initialState);
  status.textContent = `Generated solvable level ${currentSeed}.`;
  render();
});
document.querySelector("[data-action='restart']").addEventListener("pointerup", () => {
  state = cloneState(initialState);
  status.textContent = "Level restarted.";
  render();
});
render();
