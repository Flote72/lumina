#version 300 es
precision highp float;
// Mask pass: one draw per mask into one layer of an R8 array texture, at viewport resolution.
// Formulas mirror src/core/mask/eval.ts.
uniform sampler2D uWork;     // geometry output (for luminance / colour range)
uniform sampler2D uBrush0;
uniform sampler2D uBrush1;
uniform sampler2D uBrush2;
uniform sampler2D uBrush3;
//#include geomMap

uniform int uN;
uniform int uKind[12];       // 1 brush, 2 linear, 3 radial, 4 luminance, 5 colour
uniform int uOp[12];         // 0 add, 1 subtract, 2 intersect
uniform int uInv[12];
uniform vec4 uP0[12];
uniform vec4 uP1[12];
uniform bool uMaskInv;
uniform float uAmount;
out vec4 outColor;

float ss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec3 enc(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float brushAt(int slot, vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  if (slot == 0) return texture(uBrush0, uv).a;
  if (slot == 1) return texture(uBrush1, uv).a;
  if (slot == 2) return texture(uBrush2, uv).a;
  return texture(uBrush3, uv).a;
}

void main() {
  vec2 o;
  vec2 p = mapToSource(gl_FragCoord.xy, o);
  vec4 w = texture(uWork, gl_FragCoord.xy / uSize);
  vec3 rgb = w.a > 0.0 ? enc(w.rgb / w.a) : vec3(0.0);
  float L = lum(rgb);
  float Lm = max(uImg.x, uImg.y);

  float acc = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= uN) break;
    float v = 0.0;
    int k = uKind[i];
    vec4 A = uP0[i];
    vec4 B = uP1[i];
    if (k == 1) {
      v = brushAt(int(A.x + 0.5), p / uImg);
    } else if (k == 2) {                               // linear: A = x0,y0,x1,y1 (px)
      vec2 d = A.zw - A.xy;
      float len2 = dot(d, d);
      v = len2 < 1e-6 ? 0.0 : 1.0 - ss(0.0, 1.0, dot(p - A.xy, d) / len2);
    } else if (k == 3) {                               // radial: A = cx,cy,rx,ry (px) B = angle, feather
      vec2 q = p - A.xy;
      float c = cos(-B.x), s = sin(-B.x);
      q = vec2(q.x * c - q.y * s, q.x * s + q.y * c) / max(A.zw, vec2(1e-3));
      float inner = min(1.0 - B.y > 0.0 ? 1.0 - B.y : 0.0, 0.999);
      v = 1.0 - ss(inner, 1.0, length(q));
    } else if (k == 4) {                               // luminance: A = lo, hi, smooth
      float s = max(A.z, 0.005);
      v = ss(A.x - s, A.x, L) * (1.0 - ss(A.y, A.y + s, L));
    } else if (k == 5) {                               // colour: A = r,g,b (encoded), B.x = range 0..1
      float lt = lum(A.rgb);
      vec3 dc = (rgb - L) - (A.rgb - lt);
      float d = sqrt(dot(dc, dc) + pow(0.35 * (L - lt), 2.0));
      float rad = 0.04 + 0.46 * B.x;
      v = 1.0 - ss(rad * 0.4, rad, d);
    }
    v = clamp(v, 0.0, 1.0);
    if (uInv[i] == 1) v = 1.0 - v;
    int op = uOp[i];
    acc = op == 0 ? acc + v - acc * v : (op == 1 ? acc * (1.0 - v) : acc * v);
  }
  if (uMaskInv) acc = 1.0 - acc;
  outColor = vec4(clamp(acc, 0.0, 1.0) * uAmount, 0.0, 0.0, 1.0);
}
