import * as Phaser from "phaser";
import { Graph } from "./Graph";
import { SCC } from "./SCC";
import * as scc from "strongly-connected-components";
import chroma from "chroma-js";

type Point = { x: number; y: number };
type Agent = { pos: Point; vel: Point };
type Node = { pos: Point; neighbors: Point[] };

class MyScene extends Phaser.Scene {
  movementDirection = { x: 0, y: 0 };
  player: Phaser.GameObjects.Image;
  layer: Phaser.Tilemaps.TilemapLayer;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  passBotAgents: { x: number; y: number; velX: number; velY: number }[];
  graph: Graph;

  counter = 0;
  tileSize: number;

  preload() {
    this.load.image("tiles", "../public/images/DashpaintTilesetV2.png");
    this.load.image("character", "../public/images/DashpaintCharacter.png");
    // this.load.tilemapCSV("map", "../public/phaser3examples/grid.csv");
  }

  create() {
    
    const mapSize = 30;
    this.tileSize = 8;
    var map = this.make.tilemap({
      // key: "map",
      width: mapSize,
      height: mapSize,
      tileWidth: this.tileSize,
      tileHeight: this.tileSize,
    });

    var tileset = map.addTilesetImage("tiles", null, this.tileSize, this.tileSize, 0, 0);

    // this.layer = map.createLayer(0, tileset, 0, 0);
    this.layer = map.createBlankLayer("ShitLayer1", tileset);

    this.layer.fill(2, 0, 0, mapSize, mapSize);
    this.layer.fill(1, 1, 1, mapSize - 2, mapSize - 2);
    this.layer.weightedRandomize(
      [
        { index: 0, weight: 4 }, // walkable
        { index: 2, weight: 1 }, // not walkable
      ],
      1,
      1,
      mapSize - 2,
      mapSize - 2
    );

    this.player = this.add.image(
      this.tileSize * 2 + this.tileSize / 2,
      this.tileSize + this.tileSize / 2,
      "character"
    );

    this.colorMap();

    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.zoomTo(5, 1000, "Quad");

    this.cursors = this.input.keyboard.createCursorKeys();
  }

  colorMap() {
    this.graph = this.createGraph({
      x: this.player.x - this.tileSize / 2,
      y: this.player.y - this.tileSize / 2,
    });

    console.log(
      // this.simplifyAdjacencyList(
      this.graph.adjacencyList
      // )
    );

    const processedAdjacencyList = this.toNumberAdjacencyList({
      adjacencyList: this.graph.adjacencyList,
    });
    // console.log(this.toNumberAdjacencyList(this.graph.adjacencyList));

    const sccInput: number[][] = processedAdjacencyList.numberAdjacencyList;
    const sccOutput: { adjacencyList: number[][]; components: number[][] } =
      scc(sccInput);
    const tileConnectedComponents = sccOutput.components.map((component) =>
      component.map((sourceNumber) =>
        this.stringToPoint(processedAdjacencyList.values[sourceNumber])
      )
    );
    console.log(tileConnectedComponents);

    const colors = chroma
      .scale(["yellow", "008ae5"])
      .colors(tileConnectedComponents.length);

    for (const [
      index,
      tileConnectedComponent,
    ] of tileConnectedComponents.entries()) {
      const color = colors[index];
      for (const tileInComponent of tileConnectedComponent) {
        const tile = this.layer.getTileAtWorldXY(
          tileInComponent.x,
          tileInComponent.y
        );
        tile.index = 18;
        console.log(" setting color to ", color);
        tile.tint = Number(color.replace("#", "0x"));
      }
    }
  }

  toNumberAdjacencyList({
    adjacencyList,
  }: {
    adjacencyList: { [x: string]: any };
  }) {
    const sources = Object.keys(adjacencyList);
    const output: number[][] = [];
    for (const [index, source] of sources.entries()) {
      const destinations: Set<string> = adjacencyList[source];
      const mappedDestinations = [...destinations].map((d) =>
        sources.indexOf(d)
      );
      output[index] = mappedDestinations;
    }
    return { numberAdjacencyList: output, values: sources };
  }

  pointToString(p: Point): string {
    return JSON.stringify({ x: p.x, y: p.y });
  }

  stringToPoint(s: string): Point {
    return JSON.parse(s);
  }

  getNeighbors(p: Point): Point[] {
    // console.log("getting neighbors of ", p);
    const neighbors: Point[] = [];

    const directions = [
      { x: -this.tileSize, y: 0 },
      { x: this.tileSize, y: 0 },
      { x: 0, y: -this.tileSize },
      { x: 0, y: this.tileSize },
    ];

    for (const direction of directions) {
      const currentPosition = {
        x: p.x,
        y: p.y,
      };

      let tile = this.layer.getTileAtWorldXY(
        currentPosition.x + direction.x,
        currentPosition.y + direction.y,
        true
      );
      if (tile === null || tile.index === -1) {
        console.error(
          tile,
          "is not defined, but was queried currentPosition:",
          currentPosition,
          direction
        );
        throw new Error("see error above");
      }

      while (tile.index !== 2) {
        this.counter++;
        // if (this.counter > 20) throw Error("shit");
        currentPosition.x += direction.x;
        currentPosition.y += direction.y;

        tile = this.layer.getTileAtWorldXY(
          currentPosition.x + direction.x,
          currentPosition.y + direction.y,
          true
        );
        if (tile.index === 0) {
          tile.index = 17;
          // tile.tint = 0xffff00
        }
      }

      if (currentPosition.x !== p.x || currentPosition.y !== p.y) {
        neighbors.push(currentPosition);
      }
    }
    console.log("neighbors of ", p, "is", neighbors);
    return neighbors;
  }

  createGraph(start: Point): Graph {
    const myGraph: Graph = new Graph();
    console.log("creating graph");
    const result = new Graph();
    const stack = [this.pointToString(start)];
    const visited = {};
    visited[this.pointToString(start)] = true;
    let currentVertex: string;
    while (stack.length) {
      currentVertex = stack.pop();
      const neighbors = this.getNeighbors(
        this.stringToPoint(currentVertex)
      ).map(this.pointToString);

      for (const neighbor of neighbors) {
        result.addEdge(currentVertex, neighbor);
        if (!visited[neighbor]) {
          visited[neighbor] = true;
          stack.push(neighbor);
        }
      }
    }
    return result;

    // const verticesToExplore: Point[] = [];
    // verticesToExplore.push(start);

    // myGraph.push({
    //   pos: { x: start.x, y: start.y },
    //   neighbors: neighbors.sort(),
    // });

    // return myGraph;
  }
  simplifyAdjacencyList(adjacencyList: { [x: string]: any }): any {
    function toSimpleString(p: Point): string {
      return "" + p.x / this.tileSize + "," + p.y / this.tileSize;
    }
    const output = {};
    for (const sourcePoint in adjacencyList) {
      if (Object.prototype.hasOwnProperty.call(adjacencyList, sourcePoint)) {
        const destinationPoints: string[] = adjacencyList[sourcePoint];
        const sourcePointPoint = this.stringToPoint(sourcePoint);
        const sourcePointSimpleString = toSimpleString(sourcePointPoint);
        const destinationPointsSimpleString = destinationPoints.map((p) =>
          toSimpleString(this.stringToPoint(p))
        );
        output[sourcePointSimpleString] = destinationPointsSimpleString;
      }
    }
    return output;
  }

  update() {
    if (this.movementDirection.x === 0 && this.movementDirection.y === 0) {
      if (this.input.keyboard.checkDown(this.cursors.left, 100)) {
        this.movementDirection.x = -this.tileSize;
        this.updateAngle();
      } else if (this.input.keyboard.checkDown(this.cursors.right, 100)) {
        this.movementDirection.x = this.tileSize;
        this.updateAngle();
      } else if (this.input.keyboard.checkDown(this.cursors.up, 100)) {
        this.movementDirection.y = -this.tileSize;
        this.updateAngle();
      } else if (this.input.keyboard.checkDown(this.cursors.down, 100)) {
        this.movementDirection.y = this.tileSize;
        this.updateAngle();
      }
    }

    var tile = this.layer.getTileAtWorldXY(
      this.player.x + this.movementDirection.x,
      this.player.y + this.movementDirection.y,
      true
    );

    if (tile.index === 2) {
      this.movementDirection = { x: 0, y: 0 };
    } else {
      this.player.x += this.movementDirection.x;
      this.player.y += this.movementDirection.y;
      tile.index = 0;
      tile.tint = 0xffff00;
    }
  }

  updateAngle() {
    this.player.angle = this.getAngle(
      this.movementDirection.x,
      this.movementDirection.y
    );
  }

  getAngle(x: number, y: number): number {
    var angle = Math.atan2(y, x);
    var degrees = (180 * angle) / Math.PI;
    return (360 + Math.round(degrees)) % 360;
  }
}

var config = {
  type: Phaser.AUTO,
  width: 1800,
  height: 800,
  parent: "phaser-example",
  pixelArt: true,
  backgroundColor: "#000000",
  scene: [MyScene],
};

const game = new Phaser.Game(config);
// stackoverflow.com/a/35271543

const stronglyConnectedComponentsTest = new SCC();
