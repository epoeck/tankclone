/** EulerVector do DDTank Reborn / C#: arredonda cada operação, inclusive dt, em float32.
 * Referência e licença: third_party/ddtank-reborn e docs/ddtank-reborn.md. */
export function eulerStep(x: number, v: number, mass: number, airForce: number, force: number, dt: number): [number, number, number] {
  const f = Math.fround;
  dt = f(dt);
  const a = f(f(f(force) - f(f(airForce) * f(v))) / f(mass));
  const nextV = f(f(v) + f(a * dt));
  return [f(f(x) + f(nextV * dt)), nextV, a];
}
