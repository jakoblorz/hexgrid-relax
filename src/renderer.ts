import * as BABYLON from 'babylonjs';
import { Grid, NumberGeneratorFactory } from "./grid";

export default class Renderer {
  // private _canvas: HTMLCanvasElement;
  // private _engine: BABYLON.Engine;
  private _scene!: BABYLON.Scene;
  private _grid: Grid = new Grid(8, NumberGeneratorFactory(Math.random() * Number.MAX_SAFE_INTEGER));
  private _gridLines: { [x: string]: BABYLON.LinesMesh } = {};

  createScene(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
    // this._canvas = canvas;
    // this._engine = engine;

    // This creates a basic Babylon Scene object (non-mesh)
    this._scene = new BABYLON.Scene(engine);

    // This creates and positions a free camera (non-mesh)
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), this._scene);

    // This targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this._scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    // Our built-in 'sphere' shape. Params: name, subdivs, size, scene
    const sphere = BABYLON.Mesh.CreateSphere("sphere1", 16, 1, this._scene);

    // Move the sphere upward 1/2 its height
    sphere.position.y = 1;

    // Our built-in 'ground' shape. Params: name, width, depth, subdivs, scene
    const ground = BABYLON.Mesh.CreateGround("ground1", 6, 6, 2, this._scene);

    this.renderGridLines();
  }

  renderGridLines() {
    for (let i = 0; i < this._grid.points.length; i++) {
      const point = this._grid.points[i];
      const neighbours = this._grid.neighbours[i];

      for (let k = 0; k < neighbours.length; k++) {
        const npoint = this._grid.points[neighbours[k]];
        const points = [
          new BABYLON.Vector3(point[0] * 6, 0, point[1] * 6),
          new BABYLON.Vector3(npoint[0] * 6, 0, npoint[1] * 6),
        ];

        this._gridLines[`lines-${i}-${k}`] = BABYLON.MeshBuilder.CreateLines(`lines-${i}-${k}`, {
          points: points,
          updatable: true,
          instance: this._gridLines[`lines-${i}-${k}`],
        }, this._scene);
      }
    }
  }

  initialize(canvas: HTMLCanvasElement) {
    const engine = new BABYLON.Engine(canvas, true);
    this.createScene(canvas, engine);

    engine.runRenderLoop(() => {
      this._scene.render();
    });

    window.addEventListener('resize', function () {
      engine.resize();
    });

    this._grid.on("pointsUpdated", () => {
      this.renderGridLines();
    });
    this._grid.relaxSide();
  }
}

const renderer = new Renderer();
renderer.initialize(document.getElementById('render-canvas') as HTMLCanvasElement);