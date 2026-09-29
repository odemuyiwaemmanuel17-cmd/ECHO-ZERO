/** Metre-scale footprints of the authored chamber furnishings, including 0.25 m player clearance.
 * Keep the centre aisle and initial spawn open. The slab and moving canopy are not full-height walls.
 */
export const containmentSolids = [
  [-1.08, 1.08, -1.05, -.52], // primary cradle back
  [-1.12, -.58, -.65, .43], [ .58, 1.12, -.65, .43], // cradle side frames
  [-4.46, -2.14, 1.45, 3.57], // secondary treatment pod
  [-2.76, -1.3, 2.61, 3.79], // bedside cart
  [2.82, 4.28, -3.09, -1.91], // supply cart
  [3.38, 4.65, 3.36, 4.24], // secured oxygen bank
  [2.07, 4.91, -5.99, -4.8], // medical cabinets
  [2.03, 3.47, .69, 2.31], // wheelchair
  [-4.4, -2.8, -5.15, -3.95], // specimen preparation bench
  [3.86, 4.85, -.31, 1.29], // hanging service hatch
] as const;

export function chamberBlocked(x: number, z: number) {
  return z < 6 && containmentSolids.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
}
