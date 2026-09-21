// Shared by geometry.frag and mask.frag (included textually): viewport pixel -> source-image pixel.
// Keep in sync with src/core/geometry/map.ts.
uniform vec2 uSize;   // target px
uniform vec2 uImg;    // original image size px
uniform vec2 uC;      // frame/crop centre in source px
uniform float uAngle; // radians
uniform float uZoom;  // device px per output px
uniform vec2 uPan;    // device px
uniform float uKv, uKh;      // perspective (vertical / horizontal)
uniform float uScale;        // 1 = unchanged
uniform float uAspect;       // -1..1
uniform vec2 uOff;           // px
uniform float uDist;         // lens distortion (+ corrects barrel)

vec2 mapToSource(vec2 fragCoord, out vec2 o) {
  vec2 v = vec2(fragCoord.x, uSize.y - fragCoord.y);
  o = (v - uSize * 0.5 - uPan) / uZoom;
  float c = cos(-uAngle), s = sin(-uAngle);
  vec2 p0 = uC + vec2(o.x * c - o.y * s, o.x * s + o.y * c);
  vec2 ic = uImg * 0.5;
  vec2 u = p0 - ic - uOff;
  float ax = exp(0.35 * uAspect);
  u /= uScale * vec2(ax, 1.0 / ax);
  float S = max(ic.x, ic.y);
  u /= max(1.0 + uKv * u.y / S + uKh * u.x / S, 0.2);
  float rd = length(u) / length(ic);
  u *= 1.0 - uDist * rd * rd;
  return ic + u;
}
