export { useBallsSource, SOURCE_ID as BALLS_ID } from "./Balls";
export { useGeometrySource, SOURCE_ID as GEOMETRY_ID } from "./Geometry";
export { useParticlesSource, SOURCE_ID as PARTICLES_ID } from "./Particles";
export { useMetaballsSource, SOURCE_ID as METABALLS_ID } from "./Metaballs";
export { useFractalTreeSource, SOURCE_ID as FRACTAL_ID } from "./FractalTree";
export { useFlowFieldSource, SOURCE_ID as FLOWFIELD_ID } from "./FlowField";
export {
  useKaleidoscopeSource,
  SOURCE_ID as KALEIDOSCOPE_ID,
} from "./Kaleidoscope";
export { useGameOfLifeSource, SOURCE_ID as LIFE_ID } from "./GameOfLife";
export { useLissajousSource, SOURCE_ID as LISSAJOUS_ID } from "./Lissajous";
export { useSpirographSource, SOURCE_ID as SPIROGRAPH_ID } from "./Spirograph";
export { useVoronoiSource, SOURCE_ID as VORONOI_ID } from "./Voronoi";
export { useMatrixSource, SOURCE_ID as MATRIX_ID } from "./Matrix";
export { usePlasmaSource, SOURCE_ID as PLASMA_ID } from "./Plasma";
export { usePendulumSource, SOURCE_ID as PENDULUM_ID } from "./Pendulum";
export { useStarfieldSource, SOURCE_ID as STARFIELD_ID } from "./Starfield";
export { useRipplesSource, SOURCE_ID as RIPPLES_ID } from "./Ripples";

export const SOURCES = [
  { id: "balls", label: "Balls" },
  { id: "geometry", label: "Geometry" },
  { id: "particles", label: "Particles" },
  { id: "metaballs", label: "Metaballs" },
  { id: "fractal", label: "Fractal" },
  { id: "flowfield", label: "Flow" },
  { id: "kaleidoscope", label: "Kaleid" },
  { id: "life", label: "Life" },
  { id: "lissajous", label: "Lissajous" },
  { id: "spirograph", label: "Spiro" },
  { id: "voronoi", label: "Voronoi" },
  { id: "matrix", label: "Matrix" },
  { id: "plasma", label: "Plasma" },
  { id: "pendulum", label: "Pendulum" },
  { id: "starfield", label: "Stars" },
  { id: "ripples", label: "Ripples" },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];
