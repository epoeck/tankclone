/** SmallMapView usa escala uniforme limitada a 240×96; centramos a área no painel disponível. */
export interface MiniTransform { x: number; y: number; scale: number; width: number; height: number }
export function miniTransform(mapWidth: number, mapHeight: number, panelWidth: number, panelHeight: number): MiniTransform {
  const unit = Math.min(panelWidth / 240, panelHeight / 96);
  const scale = Math.min(240 / mapWidth, 96 / mapHeight) * unit;
  const width = mapWidth * scale, height = mapHeight * scale;
  return { x: (panelWidth - width) / 2, y: (panelHeight - height) / 2, scale, width, height };
}
export function miniToMap(t: MiniTransform, x: number, y: number): { x: number; y: number } {
  return { x: Math.max(0, Math.min(t.width, x - t.x)) / t.scale, y: Math.max(0, Math.min(t.height, y - t.y)) / t.scale };
}
export function mapToMini(t: MiniTransform, x: number, y: number): { x: number; y: number } {
  return { x: t.x + x * t.scale, y: t.y + y * t.scale };
}
