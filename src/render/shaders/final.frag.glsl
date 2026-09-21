#version 300 es
precision highp float;
precision highp sampler2DArray;
// Final pass. Order: WB/exposure (linear) → dehaze → tone → tone curve → presence → colour mixer →
// vibrance/saturation → colour grading → sharpen → post-crop vignette → grain → clip overlay.
uniform sampler2D uWork;
uniform sampler2D uBlurS; // small-radius blur (texture)
uniform sampler2D uBlurL; // large-radius blur (clarity / dehaze)
uniform sampler2D uBlurR; // sharpening-radius blur
uniform sampler2D uCurve; // 256x1 per-channel tone curve
uniform vec2 uSize;
uniform vec2 uUvOffset;
uniform vec2 uUvScale;
uniform vec2 uViewport;  // canvas size (px)
uniform vec2 uPan;
uniform float uZoom;
uniform vec2 uHalfFrame; // half size of visible frame (output px)

uniform vec3 uGain;      // WB gains * exposure
uniform float uContrast, uHighlights, uShadows, uWhites, uBlacks;
uniform float uTexture, uClarity, uDehaze, uVibrance, uSaturation;
uniform sampler2DArray uMasks;   // local-adjustment masks (one layer per visible mask)
uniform int uMaskN;
uniform vec4 uLocA[12];  // contrast, highlights, shadows, saturation
uniform vec4 uLocB[12];  // texture, clarity, dehaze, sharpness
uniform vec4 uLocC[12];  // noise
uniform vec3 uLocGain[12]; // linear gain from exposure + white balance
uniform int uOverlay;    // layer index shown as a red overlay (-1 = none)
uniform bool uClip;
uniform bool uCurveOn;
uniform bool uMixOn;
uniform float uMixHue[8], uMixSat[8], uMixLum[8];
uniform bool uBW;
uniform float uGrayMix[8];
uniform bool uGradeOn;
uniform vec3 uGradeCol[4];   // shadows, mids, highlights, global chroma offsets
uniform float uGradeLum[4];
uniform float uBlend, uBalance;
uniform float uSharpAmt, uSharpDetail, uSharpMask;
uniform float uVigAmt, uVigMid, uVigRound, uVigFeather;
uniform float uGrainAmt, uGrainSize, uGrainRough;
out vec4 outColor;

vec3 enc(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 dec(vec3 e) {
  e = max(e, vec3(0.0));
  return mix(e / 12.92, pow((e + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), e));
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

vec3 rgb2hsl(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float l = (mx + mn) * 0.5, d = mx - mn;
  if (d < 1e-6) return vec3(0.0, 0.0, l);
  float s = d / (1.0 - abs(2.0 * l - 1.0) + 1e-6);
  float h;
  if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h * 60.0, s, l);
}
vec3 hsl2rgb(vec3 hsl) {
  float h = mod(hsl.x, 360.0), s = clamp(hsl.y, 0.0, 1.0), l = clamp(hsl.z, 0.0, 1.0);
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 r;
  if (h < 60.0) r = vec3(c, x, 0.0);
  else if (h < 120.0) r = vec3(x, c, 0.0);
  else if (h < 180.0) r = vec3(0.0, c, x);
  else if (h < 240.0) r = vec3(0.0, x, c);
  else if (h < 300.0) r = vec3(x, 0.0, c);
  else r = vec3(c, 0.0, x);
  return r + m;
}

const float CENTERS[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0);

vec3 applyMixer(vec3 e) {
  vec3 hsl = rgb2hsl(clamp(e, 0.0, 1.0));
  float dh = 0.0, ds = 0.0, dl = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = CENTERS[i];
    float b = (i == 7) ? 360.0 : CENTERS[i + 1];
    if (hsl.x >= a && hsl.x < b) {
      float t = (hsl.x - a) / (b - a);
      t = t * t * (3.0 - 2.0 * t);
      int j = (i + 1) % 8;
      dh = mix(uMixHue[i], uMixHue[j], t);
      ds = mix(uMixSat[i], uMixSat[j], t);
      dl = mix(uMixLum[i], uMixLum[j], t);
    }
  }
  float cw = sm(0.02, 0.2, hsl.y); // near-greys have no meaningful hue
  hsl.x += dh * 30.0 * cw;
  hsl.y *= 1.0 + ds * cw;
  hsl.z = hsl.z + dl * 0.25 * cw * (1.0 - abs(2.0 * hsl.z - 1.0));
  return hsl2rgb(hsl);
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// Local (mask) adjustment of an already graded pixel.
vec3 localAdjust(vec3 x, vec4 A, vec4 B, vec4 Cc, vec3 gain, float L0, vec3 bsE, vec3 blE, float mid) {
  x = enc(dec(x) * gain);
  float Y = lum(x);
  float ws = 1.0 - sm(0.0, 0.55, Y);
  x = x * (1.0 + A.z * 0.7 * ws) + A.z * 0.04 * ws;
  x *= 1.0 + A.y * 0.5 * sm(0.45, 1.0, Y);
  if (A.x >= 0.0) x = mix(x, x * x * (3.0 - 2.0 * x), A.x * 1.5);
  else x = mix(x, vec3(0.5), -A.x * 0.6);
  if (B.z != 0.0) {
    float haze = min(blE.r, min(blE.g, blE.b));
    if (B.z > 0.0) x = (x - vec3(0.95) * B.z * 0.7 * haze) / max(1.0 - B.z * 0.7 * haze, 0.15);
    else x = mix(x, vec3(0.85), -B.z * 0.4);
  }
  x += B.x * 0.9 * (L0 - lum(bsE));
  x += B.y * 1.1 * mid * (L0 - lum(blE));
  x += B.w * 1.6 * (L0 - lum(bsE));
  x = mix(x, bsE, clamp(Cc.x, 0.0, 1.0));
  return mix(vec3(lum(x)), x, 1.0 + A.w);
}

void main() {
  vec2 uv = uUvOffset + (gl_FragCoord.xy / uSize) * uUvScale;
  vec4 w = texture(uWork, uv);
  if (w.a <= 0.0) { outColor = vec4(0.0); return; }
  vec3 base = w.rgb / w.a;
  float ia = 1.0 / max(w.a, 1e-3);

  vec3 e = enc(base * uGain);
  vec3 e0 = e;
  vec3 bs = enc(texture(uBlurS, uv).rgb * ia * uGain);
  vec3 bl = enc(texture(uBlurL, uv).rgb * ia * uGain);

  // Dehaze
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

  // Tone curve (per channel, sRGB-encoded)
  if (uCurveOn) {
    vec3 x = clamp(e, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0;
    e = vec3(texture(uCurve, vec2(x.r, 0.5)).r, texture(uCurve, vec2(x.g, 0.5)).g, texture(uCurve, vec2(x.b, 0.5)).b);
  }

  // Presence: local contrast from the un-toned luminance difference
  float L0 = lum(e0);
  float mid = 1.0 - 0.7 * pow(abs(2.0 * clamp(L0, 0.0, 1.0) - 1.0), 2.0);
  e += uTexture * 0.9 * (L0 - lum(bs));
  e += uClarity * 1.1 * mid * (L0 - lum(bl));

  // Colour mixer
  if (uMixOn) e = applyMixer(e);

  // Vibrance / saturation
  float Lc = lum(e);
  if (uVibrance != 0.0) {
    vec3 hsv = rgb2hsv(clamp(e, 0.0, 1.0));
    float skin = 1.0 - 0.5 * exp(-pow((hsv.x - 0.08) / 0.06, 2.0));
    float amt = uVibrance * (1.0 - hsv.y) * skin;
    e = mix(vec3(Lc), e, 1.0 + amt);
  }
  e = mix(vec3(lum(e)), e, 1.0 + uSaturation);

  // Local adjustments (masks)
  float overlayA = 0.0;
  for (int k = 0; k < 12; k++) {
    if (k >= uMaskN) break;
    float a = texture(uMasks, vec3(uv, float(k))).r;
    if (k == uOverlay) overlayA = a;
    if (a > 0.002) e = mix(e, localAdjust(e, uLocA[k], uLocB[k], uLocC[k], uLocGain[k], L0, bs, bl, mid), a);
  }

  // Black & white with per-colour weights
  if (uBW) {
    vec3 hsl = rgb2hsl(clamp(e, 0.0, 1.0));
    float k = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = CENTERS[i];
      float b = (i == 7) ? 360.0 : CENTERS[i + 1];
      if (hsl.x >= a && hsl.x < b) {
        float t = (hsl.x - a) / (b - a);
        t = t * t * (3.0 - 2.0 * t);
        k = mix(uGrayMix[i], uGrayMix[(i + 1) % 8], t);
      }
    }
    float g = lum(e) * (1.0 + k * 0.7 * sm(0.02, 0.2, hsl.y));
    e = vec3(g);
  }

  // Colour grading (luminance-weighted regions)
  if (uGradeOn) {
    float Yg = clamp(lum(e), 0.0, 1.0);
    float p = 0.5 + uBalance * 0.3;
    float bw = mix(0.12, 0.5, uBlend);
    float wS = 1.0 - sm(p - bw, p, Yg);
    float wH = sm(p, p + bw, Yg);
    float wM = max(0.0, 1.0 - wS - wH);
    e += uGradeCol[0] * wS + uGradeCol[1] * wM + uGradeCol[2] * wH + uGradeCol[3];
    e += uGradeLum[0] * wS + uGradeLum[1] * wM + uGradeLum[2] * wH + uGradeLum[3];
  }

  // Sharpen (unsharp mask on luminance with detail limiter and edge masking)
  if (uSharpAmt > 0.0) {
    float diff = L0 - lum(enc(texture(uBlurR, uv).rgb * ia * uGain));
    float limited = clamp(diff, -0.06, 0.06) * 1.6;
    float d = mix(limited, diff, uSharpDetail);
    float mask = mix(1.0, sm(0.004, 0.05, abs(diff)), uSharpMask);
    e += uSharpAmt * 1.6 * d * mask;
  }

  // Post-crop vignette (in output-frame coordinates)
  vec2 vpx = vec2(uv.x * uViewport.x, (1.0 - uv.y) * uViewport.y);
  vec2 o = (vpx - uViewport * 0.5 - uPan) / uZoom;
  if (uVigAmt != 0.0) {
    vec2 q = o / uHalfFrame;                                   // -1..1 across the frame
    vec2 qc = o / length(uHalfFrame);                          // circle in pixel space
    vec2 r2 = mix(q, qc * 1.4142, clamp(uVigRound, 0.0, 1.0));
    float n = mix(2.0, 6.0, clamp(-uVigRound, 0.0, 1.0));
    float r = pow(pow(abs(r2.x), n) + pow(abs(r2.y), n), 1.0 / n) / pow(2.0, 1.0 / n);
    float width = mix(0.03, 0.7, uVigFeather);
    float t = sm(uVigMid - width, uVigMid + width, r * 1.0);
    if (uVigAmt < 0.0) e *= 1.0 + uVigAmt * t;
    else e = mix(e, vec3(1.0), uVigAmt * t * 0.8);
  }

  // Grain
  if (uGrainAmt > 0.0) {
    float cell = max(1.0, (1.0 + uGrainSize * 3.0) * uZoom);
    vec2 gp = floor(vpx / cell);
    float nr = hash(gp);
    float ns = vnoise(vpx / cell * 0.9);
    float n = mix(ns, nr, uGrainRough) - 0.5;
    float Lg = clamp(lum(e), 0.0, 1.0);
    e += n * uGrainAmt * 0.35 * (0.35 + 0.65 * (1.0 - abs(2.0 * Lg - 1.0)));
  }

  e = clamp(e, 0.0, 1.0);
  if (overlayA > 0.0) e = mix(e, vec3(0.95, 0.12, 0.12), overlayA * 0.55);
  if (uClip) {
    if (max(e.r, max(e.g, e.b)) >= 0.996) e = vec3(1.0, 0.15, 0.15);
    else if (min(e.r, min(e.g, e.b)) <= 0.004) e = vec3(0.15, 0.35, 1.0);
  }
  outColor = vec4(e * w.a, w.a);
}
