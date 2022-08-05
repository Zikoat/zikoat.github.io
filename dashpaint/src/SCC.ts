import * as scc from "strongly-connected-components";

const nodes = ["1,0", "1,1", "0,1", "2,1"];

var adjacencyList = [
  [1], // 0
  [0, 2, 3], // 1
  [3], // 2
  [2], // 3
];

export class SCC {
  constructor() {
    console.log(scc(adjacencyList));
  }
}
