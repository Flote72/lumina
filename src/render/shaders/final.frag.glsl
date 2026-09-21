#version 300 es
precision highp float;
// Final pass: white balance/exposure in linear light, tone + presence in a perceptual (sRGB-encoded) domain.
uniform sampler2D uWork;
uniform sampler2D uBlurS; // small-radius blur (texture)
uniform sampler2D uBlurL; // large-radius blur (clarity / dehaze)
uniform vec2 uSize;
uniform vec2 uUvOffset;
uniform vec2 uUvScale;
uniform vec3 uGain;     // WB gains * exposure
uniform float uContrast, uHighlights, uShadows, uWhites, uBlacks;
uniform float uTexture, uClarity, uDehaze, uVibrance, uSaturation;
uniform bool uClip;
out vec4 outColor;

vec3 enc(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float sm(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}

void main() {
  vec2 uv = uUvOffset + (gl_FragCoord.xy / uSize) * uUvScale;
  vec4 w = texture(uWork, uv);
  if (w.a <= 0.0) { outColor = vec4(0.0); return; }
  vec3 base = w.rgb / w.a;

  vec3 e = enc(base * uGain);
  vec3 e0 = e;
  vec3 bs = enc(texture(uBlurS, uv).rgb / max(w.a, 1e-3) * uGain);
  vec3 bl = enc(texture(uBlurL, uv).rgb / max(w.a, 1e-3) * uGain);

  // Dehaze: estimate haze from the large-radius dark channel, remove (or add) it.
  if (uDehaze != 0.0) {
    float haze = min(bl.r, min(bl.g, bl.b));
    if (uDehaze > 0.0) {
      float t = 1.0 - uDehaze * 0.7 * haze;
      e = (e - vec3(0.95) * (1.0 - t)) / max(t, 0.15);
    } else {
      e = mix(e, vec3(0.85), -uDehaze * 0.4);
    }
  }

  // Tone
  float Y = lum(e);
  e += uBlacks * 0.12 * pow(1.0 - clamp(Y, 0.0, 1.0), 4.0);
  e += uWhites * 0.12 * pow(clamp(Y, 0.0, 1.0), 4.0);
  float ws = 1.0 - sm(0.0, 0.55, Y);
  e = e * (1.0 + uShadows * 0.7 * ws) + uShadows * 0.04 * ws;
  float wh = sm(0.45, 1.0, Y);
  e *= 1.0 + uHighlights * 0.5 * wh;
  if (uContrast >= 0.0) {
    vec3 s = e * e * (3.0 - 2.0 * e);
    e = mix(e, s, uContrast * 1.5);
  } else {
    e = mix(e, vec3(0.5), -uContrast * 0.6);
  }

  // Presence: local contrast from the un-toned luminance difference
  float L0 = lum(e0);
  float mid = 1.0 - 0.7 * pow(abs(2.0 * clamp(L0, 0.0, 1.0) - 1.0), 2.0);
  e += uTexture * 0.9 * (L0 - lum(bs));
  e += uClarity * 1.1 * mid * (L0 - lum(bl));

  // Vibrance / saturation
  float Lc = lum(e);
  if (uVibrance != 0.0) {
    vec3 hsv = rgb2hsv(clamp(e, 0.0, 1.0));
    float skin = 1.0 - 0.5 * exp(-pow((hsv.x - 0.08) / 0.06, 2.0));
    float amt = uVibrance * (1.0 - hsv.y) * skin;
    e = mix(vec3(Lc), e, 1.0 + amt);
  }
  e = mix(vec3(lum(e)), e, 1.0 + uSaturation);
  e = clamp(e, 0.0, 1.0);

  if (uClip) {
    if (max(e.r, max(e.g, e.b)) >= 0.996) e = vec3(1.0, 0.15, 0.15);
    else if (min(e.r, min(e.g, e.b)) <= 0.004) e = vec3(0.15, 0.35, 1.0);
  }
  outColor = vec4(e * w.a, w.a);
}
