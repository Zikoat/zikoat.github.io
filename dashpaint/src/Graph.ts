export class Graph {
  adjacencyList: { [x: string]: any };
  constructor() {
    this.adjacencyList = {};
  }
  addVertex(vertex: string): void {
    if (!this.adjacencyList[vertex]) {
      this.adjacencyList[vertex] = new Set();
    }
  }
  addEdge(source: string, destination: string): void {
    if (!this.adjacencyList[source]) {
      this.addVertex(source);
    }
    if (!this.adjacencyList[destination]) {
      this.addVertex(destination);
    }
    this.adjacencyList[source].add(destination);
  }
  getNeighbors(vertex: string): string[] {
    return this.adjacencyList[vertex];
  }
  removeEdge(source: string | number, destination: string | number): void {
    this.adjacencyList[source] = this.adjacencyList[source].filter(
      (vertex: any) => vertex !== destination
    );
    this.adjacencyList[destination] = this.adjacencyList[destination].filter(
      (vertex: any) => vertex !== source
    );
  }
  removeVertex(vertex: string | number): void {
    while (this.adjacencyList[vertex]) {
      const adjacentVertex = this.adjacencyList[vertex].pop();
      this.removeEdge(vertex, adjacentVertex);
    }
    delete this.adjacencyList[vertex];
  }
}
