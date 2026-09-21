#version 300 es
precision highp float;
// Pass 1: viewport pixel -> output (crop) space -> source image, sampled from a mipmapped sRGB texture
// (hardware sRGB decode => linear-light output, correct filtering).
uniform sampler2D uSrc;
uniform vec2 uSize;   // target px
uniform vec2 uImg;    // original image size px (uv = p / uImg)
uniform vec2 uC;      // frame/crop centre in source px
uniform vec2 uHalf;   // half size of the visible frame in output px
uniform float uAngle; // radians
uniform float uZoom;  // device px per output px
uniform vec2 uPan;    // device px
uniform float uKv, uKh;      // perspective (vertical / horizontal)
uniform float uScale;        // 1 = unchanged
uniform float uAspect;       // -1..1
uniform vec2 uOff;           // px
uniform float uDist;         // lens distortion (+ corrects barrel)
uniform float uVigFix;       // lens vignetting correction, -1..1
uniform float uVigMid;       // 0..1
uniform float uBleed;        // export: keep edge rows fully opaque despite rounding (px)
out vec4 outColor;

void main() {
  vec2 v = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  vec2 o = (v - uSize * 0.5 - uPan) / uZoom;
  float c = cos(-uAngle), s = sin(-uAngle);
  vec2 p0 = uC + vec2(o.x * c - o.y * s, o.x * s + o.y * c);

  // inverse of Transform (offset, scale, aspect, perspective), then inverse of lens distortion
  vec2 ic = uImg * 0.5;
  vec2 u = p0 - ic - uOff;
  float ax = exp(0.35 * uAspect);
  u /= uScale * vec2(ax, 1.0 / ax);
  float S = max(ic.x, ic.y);
  u /= max(1.0 + uKv * u.y / S + uKh * u.x / S, 0.2);
  float rd = length(u) / length(ic);
  u *= 1.0 - uDist * rd * rd;
  vec2 p = ic + u;
  vec2 uv = p / uImg;
  vec4 col = texture(uSrc, uv); // sampled in uniform control flow (mip derivatives)

  vec2 inFrame = clamp((uHalf - abs(o)) * uZoom + 0.5 + uBleed, 0.0, 1.0);
  vec2 inImg = clamp(min(p, uImg - p) * uZoom + 0.5 + uBleed, 0.0, 1.0);
  float a = inFrame.x * inFrame.y * inImg.x * inImg.y;
  // lens vignetting correction in linear light, radius measured on the source image
  float rv = length(p - ic) / length(ic);
  float vt = smoothstep(uVigMid, 1.0, rv);
  float gain = max(1.0 + uVigFix * vt * vt * 2.0, 0.0);
  outColor = vec4(col.rgb * gain * a, a);
}
