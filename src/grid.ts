// https://twitter.com/OskSta/status/1169940644669861888?s=20
// https://codepen.io/sketchpunk/pen/jONYwoX
// https://www.redblobgames.com/grids/hexagons/
// https://www.kchapelier.com/hexagrid-relaxing/
// https://github.com/CedricGuillemet/HexagridRelaxing

// Most prominently:
// https://github.com/kchapelier/hexagrid-relaxing

import { EmbedableEventEmitter } from "./embedable_emitter";
import { GridError } from "./errors";

// Any type of function that generates numbers
type NumberGenerator = () => number;

export function NumberGeneratorFactory(seed: number): NumberGenerator {
  let state = seed;
  return function(): number {
    const result = (state * 48271) % 2147483647;
    state = result;
    return result / 2147483647;
  }
}
 
type PossiblyEdgePoint = [number, number, boolean];
type PossiblyEdgeTriangle = [number, number, number, boolean];
type Quad = [number, number, number, number];

export type GridEventNames = "pointsUpdated" | "trianglesUpdated" | "basesUpdated" | "quadsUpdated" | "neighboursUpdated";
export class Grid extends EmbedableEventEmitter<GridEventNames> {

  static SideLength = 0.8660254037844386;

  private size: number = 0;
  private rand: NumberGenerator;
  private maxIterationCount: number;
  private forceCircleShape: boolean;

  public points: PossiblyEdgePoint[];
  public triangles: PossiblyEdgeTriangle[];
  public bases: Quad[];
  public quads: Quad[];
  public neighbours: number[][];

  private rebindAndDebounce<T>(array: Array<T>, event: GridEventNames): Array<T> {
    const push = array.push.bind(array);
    array.push = function(this: Grid, ...items: any[]): number {
      this.emit(event, items);
      return push(...items);
    }.bind(this);
    return array;
  }

  private subdivide(count: number, indices: PossiblyEdgeTriangle | Quad, middles: { [x: string]: number }, center: number) {
    const halfSegmentedIndex = new Array<number>(count);

    for (let j = 0; j < count; j++) {
      const indexA = <number>indices[j];
      const indexB = <number>indices[(j+1) % count];
      const pointA = this.points[indexA];
      const pointB = this.points[indexB];

      const key = `${Math.min(indexA, indexB)}:${Math.max(indexA, indexB)}`;
      if (!middles.hasOwnProperty(key)) {
        halfSegmentedIndex[j] = this.points.length;
        this.points.push([
          (pointA[0] + pointB[0]) / 2.0,
          (pointA[1] + pointB[1]) / 2.0,
          pointA[2] && pointB[2],
        ]);
        middles[key] = halfSegmentedIndex[j]
      } else {
        halfSegmentedIndex[j] = middles[key];
      }
    }

    for (let j = 0; j < count; j++) {
      const nextIndex = (j + 1) % count;
      this.quads.push([
        center,
        halfSegmentedIndex[j],
        <number>indices[nextIndex],
        halfSegmentedIndex[nextIndex],
      ])
    }
  }

  private getAdjacentTriangles(index: number, adjacents: number[]): number {
    const triangle = this.triangles[index];

    for (let i = 0; i < this.triangles.length; i++) {
      const ntriangle = this.triangles[i];
      if (i === index || ntriangle[3] !== true) {
        continue;
      }

      let shareCount = 0;
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          if (triangle[j] === ntriangle[k]) {
            shareCount++;
            break;
          }
        }
      }

      if (shareCount === 2) {
        adjacents.push(i);
      }
    }

    return adjacents.length;
  }

  constructor(size: number, rand: NumberGenerator = Math.random, maxIterationCount: number = 10, forceCircleShape: boolean = false) {
    super();

    if (size < 2) {
      throw new GridError.SideCountTooLowError();
    }

    this.size = size;
    this.rand = rand;
    this.maxIterationCount = maxIterationCount;
    this.forceCircleShape = forceCircleShape;

    this.points = this.rebindAndDebounce<PossiblyEdgePoint>([], "pointsUpdated");  
    this.triangles = this.rebindAndDebounce<PossiblyEdgeTriangle>([], "trianglesUpdated");
    this.bases = this.rebindAndDebounce<Quad>([], "basesUpdated");
    this.quads = this.rebindAndDebounce<Quad>([], "quadsUpdated");
    this.neighbours = this.rebindAndDebounce<number[]>([], "neighboursUpdated");  

    const maxHeight = this.size * 2 - 1;
    const maxHeightDelta = this.size - maxHeight * 0.5;
    const heightRatio = maxHeight / 2 - maxHeightDelta;

    for (let x = 0; x < this.size * 2 - 1; x++) {
      const height = (x < this.size) ? this.size + x : this.size * 3 - 2 - x;
      const heightDelta = this.size - height * 0.5;
      for (let y = 0; y < height; y++) {
        this.points.push([
          (x - this.size + 1) * Grid.SideLength / heightRatio,
          (y + heightDelta - maxHeight / 2) / heightRatio,

          // isSide
          (x === 0) || 
          (x === (this.size * 2 - 2)) || 
          (y === 0) ||
          (y === height - 1)
        ])
      }
    }

    let offset = 0;
    for (let x = 0; x < (this.size * 2 - 2); x++) {
      let height = (x < this.size) ? (this.size + x) : (this.size * 3 - 2 - x);

      if (x < this.size - 1) {
        for (let y = 0; y < height; y++) {
          this.triangles.push([
            offset + y,
            offset + y + height,
            offset + y + height + 1,
            true
          ]);
          if (y >= height - 1) {
            break;
          }
          this.triangles.push([
            offset + y + height + 1,
            offset + y + 1,
            offset + y,
            true
          ]);
        }
      } else {
        for (let y = 0; y < height; y++) {
          this.triangles.push([
            offset + y,
            offset + y + height,
            offset + y + 1,
            true
          ]);
          if (y >= height - 2) {
            break;
          }
          this.triangles.push([
            offset + y + 1,
            offset + y + height,
            offset + y + height + 1,
            true
          ]);
        }
      }

      offset += height;
    }

    let index = 0;
    const adjacents: number[] = [];
    while(1) {
      let searchCount = 0;
      do{
        index = this.rand() * this.triangles.length | 0;
        searchCount++;
      } while(searchCount < this.maxIterationCount && this.triangles[index][3] === false);

      if (searchCount === this.maxIterationCount) {
        break;
      }

      adjacents.length = 0;
      let adjacentCount = this.getAdjacentTriangles(index, adjacents);
      if (adjacentCount > 0) {
        const triangle0 = this.triangles[index];
        const triangle1 = this.triangles[adjacents[0]];

        let indices = [
          triangle0[0], triangle0[1], triangle0[2],
          triangle1[0], triangle1[1], triangle1[2]
        ].sort(function (a, b) { return a - b; })

        const quadIndices = new Array(4);
        let quadIndexCount = 1;
        quadIndices[0] = indices[0];
        for (let i = 1; i < 6; i++) {
          if (indices[i] !== indices[i - 1]) {
            quadIndices[quadIndexCount++] = indices[i];
          }
        }

        this.bases.push([
          quadIndices[0],
          quadIndices[2],
          quadIndices[3],
          quadIndices[1],
        ]);
        triangle0[3] = false;
        triangle1[3] = false;
      }
    }

    const middles: { [x: string]: number } = {};
    for (let i = 0; i < this.bases.length; i++) {
      const quad = this.bases[i];
      const center = this.points.length;

      const point0 = this.points[quad[0]];
      const point1 = this.points[quad[1]];
      const point2 = this.points[quad[2]];
      const point3 = this.points[quad[3]];

      this.points.push([
        (point0[0] + point1[0] + point2[0] + point3[0]) / 4.0,
        (point0[1] + point1[1] + point2[1] + point3[1]) / 4.0,
        false
      ]);
      this.subdivide(4, quad, middles, center);
    }

    for (let i = 0; i < this.triangles.length; i++) {
      const triangle = this.triangles[i];
      if (triangle[3] === true) {
        const center = this.points.length;

        const point0 = this.points[triangle[0]];
        const point1 = this.points[triangle[1]];
        const point2 = this.points[triangle[2]];

        this.points.push([
            (point0[0] + point1[0] + point2[0]) / 3.0,
            (point0[1] + point1[1] + point2[1]) / 3.0,
            false
        ]);

        this.subdivide(3, triangle, middles, center);
      }
    }

    this.neighbours.length = this.points.length;
    for (let i = 0; i < this.neighbours.length; i++) {
      this.neighbours[i] = [];
    }
    for (let i = 0; i < this.quads.length; i++) {
      const quad = this.quads[i];
      for (let j = 0; j < 4; j++) {
        const index1 = quad[j];
        const index2 = quad[(j + 1) & 3];

        {
            const neighbour = this.neighbours[index1];
            let good = true;
            for (let k = 0; k < neighbour.length; k++) {
              if(neighbour[k] === index2) {
                  good = false;
                  break;
              }
            }
            if (good) {
              neighbour.push(index2);
            }
        }

        {
          const neighbour = this.neighbours[index2];
          let good = true;
          for (let k = 0; k < neighbour.length; k++) {
            if(neighbour[k] === index1) {
                good = false;
                break;
            }
          }
          if (good) {
            neighbour.push(index1);
          }
        }
      }
    }

    if (this.forceCircleShape) {
      for (let i = 0; i < this.points.length; i++) {
        const point = this.points[i];

        if (point[2] === true) {
          let dist = Math.sqrt(point[0] * point[0] + point[1] * point[1]);
          point[0] /= dist;
          point[1] /= dist;
        }
      }
    }
  }

  /*
   * Relaxed using a simple sum calculation
   */
  public relax() {
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i][2] === true) {
        continue;
      }

      const neighbour = this.neighbours[i];
      let sumX = 0;
      let sumY = 0;
      for (let j = 0; j < neighbour.length; j++) {
          sumX += this.points[neighbour[j]][0];
          sumY += this.points[neighbour[j]][1];
      }
      this.points[i][0] = sumX / neighbour.length;
      this.points[i][1] = sumY / neighbour.length;
    }
  }

  /*
   * Weighted by distance, the further two points are, the more they attract each other
   * big edges will tend to shrink and small edges will tend to grow
   * this results in slightly less variance in the quads area
   * the grid also converges faster to equilibrium
   */
  public relaxWeighted() {
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i][2] === true) {
          continue;
      }

      const neighbour = this.neighbours[i];
      let sumX = 0.;
      let sumY = 0.;
      let weight = 0.;
      for (let j = 0; j < neighbour.length; j++) {
        let w = Math.sqrt(Math.pow(this.points[i][0] - this.points[neighbour[j]][0], 2) + Math.pow(this.points[i][1] - this.points[neighbour[j]][1], 2));

        sumX += this.points[neighbour[j]][0] * w;
        sumY += this.points[neighbour[j]][1] * w;
        weight+= w;
      }
      this.points[i][0] = sumX / weight;
      this.points[i][1] = sumY / weight;
    }
  }

  public relaxSide() {
    const radius = 1;

    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i][2] === false) {
          continue;
      }

      const dx = this.points[i][0];
      const dy = this.points[i][1];
      const distance = radius - Math.sqrt(dx * dx + dy * dy);

      this.points[i][0] += (dx * distance) * 0.1;
      this.points[i][1] += (dy * distance) * 0.1;
    }
  }
}