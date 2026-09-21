#version 300 es
precision highp float;
// Noise reduction (bilateral luminance, edge-aware chroma blur) and defringe, in a perceptual domain.
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uLum;      // 0..1
uniform float uColor;    // 0..1
uniform float uDefringe; // 0..1
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
vec3 tap(vec2 uv) {
  vec4 t = texture(uTex, uv);
  return enc(t.rgb / max(t.a, 1e-3));
}
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec4 c0 = texture(uTex, uv);
  if (c0.a <= 0.0) { outColor = c0; return; }
  vec3 e0 = enc(c0.rgb / c0.a);
  float L0 = lum(e0);
  vec3 e = e0;

  if (uLum > 0.0 || uColor > 0.0) {
    float sr = mix(0.02, 0.12, uLum);
    float lsum = 0.0, lw = 0.0;
    float cstride = 1.0 + uColor * 3.0;
    vec3 csum = vec3(0.0);
    float cw = 0.0;
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        vec2 d = vec2(float(i), float(j));
        float ws = exp(-dot(d, d) / 4.5);
        if (uLum > 0.0) {
          vec3 t = tap(uv + d / uSize);
          float dl = lum(t) - L0;
          float w = ws * exp(-dl * dl / (2.0 * sr * sr));
          lsum += lum(t) * w;
          lw += w;
        }
        if (uColor > 0.0) {
          vec3 t = tap(uv + d * cstride / uSize);
          float dl = lum(t) - L0;
          float w = ws * exp(-dl * dl / (2.0 * 0.08 * 0.08));
          csum += (t - lum(t)) * w;
          cw += w;
        }
      }
    }
    float Ln = uLum > 0.0 ? mix(L0, lsum / lw, min(1.0, uLum * 1.2)) : L0;
    vec3 chroma = e0 - L0;
    if (uColor > 0.0) chroma = mix(chroma, csum / cw, min(1.0, uColor * 1.2));
    e = Ln + chroma;
  }

  if (uDefringe > 0.0) {
    float gx = abs(lum(tap(uv + vec2(2.0, 0.0) / uSize)) - lum(tap(uv - vec2(2.0, 0.0) / uSize)));
    float gy = abs(lum(tap(uv + vec2(0.0, 2.0) / uSize)) - lum(tap(uv - vec2(0.0, 2.0) / uSize)));
    float edge = smoothstep(0.06, 0.25, max(gx, gy));
    float h = rgb2hsv(clamp(e, 0.0, 1.0)).x;
    float purple = smoothstep(0.70, 0.76, h) * (1.0 - smoothstep(0.86, 0.92, h));
    float green = smoothstep(0.20, 0.26, h) * (1.0 - smoothstep(0.42, 0.48, h));
    e = mix(e, vec3(lum(e)), uDefringe * edge * max(purple, green) * 0.9);
  }
  outColor = vec4(dec(e) * c0.a, c0.a);
}
