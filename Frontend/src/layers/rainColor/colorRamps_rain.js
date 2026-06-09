export const RAIN_STOPS = [
  { val: 0.0, color: [0, 255, 255, 0] },
  { val: 0.1, color: [0, 255, 255, 255] },
  { val: 2.0, color: [0, 100, 255, 255] },
  { val: 5.0, color: [0, 0, 255, 255] },
  { val: 10.0, color: [100, 0, 200, 255] },
  { val: 15.0, color: [180, 0, 180, 255] },
  { val: 20.0, color: [255, 0, 255, 255] }
];

export function buildRainColorRampTexture(ramp = RAIN_STOPS) {
  const maxRain = 20.0;
  const size = 256;
  const pixels = new Uint8Array(size * 4);
  
  for (let i = 0; i < size; i++) {
    const val = (i / 255.0) * maxRain;
    let c = ramp[0].color; // Default al mínimo (Transparente)
    
    for (let j = 0; j < ramp.length - 1; j++) {
      if (val >= ramp[j].val && val <= ramp[j+1].val) {
        const t = (val - ramp[j].val) / (ramp[j+1].val - ramp[j].val);
        c = [
          Math.round(ramp[j].color[0] + t * (ramp[j+1].color[0] - ramp[j].color[0])),
          Math.round(ramp[j].color[1] + t * (ramp[j+1].color[1] - ramp[j].color[1])),
          Math.round(ramp[j].color[2] + t * (ramp[j+1].color[2] - ramp[j].color[2])),
          Math.round(ramp[j].color[3] + t * (ramp[j+1].color[3] - ramp[j].color[3]))
        ];
        break;
      }
    }
    pixels.set(c, i * 4);
  }
  return pixels;
}
