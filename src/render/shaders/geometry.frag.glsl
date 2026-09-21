#version 300 es
precision highp float;
// Pass 1: viewport pixel -> output (crop) space -> source image, sampled from a mipmapped sRGB texture
// (hardware sRGB decode => linear-light output, correct filtering). Also applies spot removal and red-eye
// (they live in source coordinates, so they follow crop / transform / lens).
uniform sampler2D uSrc;
uniform vec2 uHalf;   // half size of the visible frame in output px
uniform float uVigFix;       // lens vignetting correction, -1..1
uniform float uVigMid;       // 0..1
uniform float uBleed;        // export: keep edge rows fully opaque despite rounding (px)
uniform float uLod;          // mip level matching the current magnification
//#include geomMap

uniform int uSpotN;
uniform vec4 uSpotA[32];     // dest.xy, src.xy (px)
uniform vec4 uSpotB[32];     // radius px, feather 0..1, opacity 0..1, mode (0 heal, 1 clone)
uniform int uRedN;
uniform vec4 uRedA[8];       // x, y, radius px, pupil 0..1
uniform vec4 uRedB[8];       // darken 0..1
out vec4 outColor;

void main() {
  vec2 o;
  vec2 p = mapToSource(gl_FragCoord.xy, o);
  vec2 uv = p / uImg;
  vec4 col = texture(uSrc, uv); // sampled in uniform control flow (mip derivatives)

  // Spot removal: clone from an offset location; "heal" also matches the surrounding low-frequency colour.
  for (int i = 0; i < 32; i++) {
    if (i >= uSpotN) break;
    vec4 A = uSpotA[i];
    vec4 B = uSpotB[i];
    float d = length(p - A.xy);
    if (d < B.x) {
      float inner = B.x * (1.0 - B.y * 0.95);
      float w = (1.0 - smoothstep(inner, B.x, d)) * B.z;
      vec3 c2 = textureLod(uSrc, (p + (A.zw - A.xy)) / uImg, uLod).rgb;
      if (B.w < 0.5) {
        // low-frequency colour around the spot vs around its source (8 samples on a ring just outside the blemish)
        float lodR = max(uLod, log2(max(B.x, 1.0)) - 1.0);
        vec3 ad = vec3(0.0);
        vec3 as = vec3(0.0);
        for (int k = 0; k < 8; k++) {
          float a = float(k) * 0.785398;
          vec2 dir = vec2(cos(a), sin(a)) * B.x * 1.15;
          ad += textureLod(uSrc, (A.xy + dir) / uImg, lodR).rgb;
          as += textureLod(uSrc, (A.zw + dir) / uImg, lodR).rgb;
        }
        c2 += (ad - as) * 0.125;
      }
      col.rgb = mix(col.rgb, max(c2, vec3(0.0)), w);
    }
  }

  // Red-eye: pull red towards the green/blue average inside a soft circle, weighted by how red the pixel is.
  for (int i = 0; i < 8; i++) {
    if (i >= uRedN) break;
    vec4 A = uRedA[i];
    float rad = A.z * (0.6 + 0.8 * A.w);
    float w = 1.0 - smoothstep(rad * 0.6, rad, length(p - A.xy));
    if (w > 0.0) {
      float gb = 0.5 * (col.g + col.b);
      float red = clamp((col.r - gb) / (col.r + 0.02) * 1.8, 0.0, 1.0);
      float k = w * red;
      col.r = mix(col.r, gb * (1.0 - uRedB[i].x * 0.5), k);
      col.gb *= 1.0 - uRedB[i].x * 0.35 * k;
    }
  }

  vec2 ic = uImg * 0.5;
  vec2 inFrame = clamp((uHalf - abs(o)) * uZoom + 0.5 + uBleed, 0.0, 1.0);
  vec2 inImg = clamp(min(p, uImg - p) * uZoom + 0.5 + uBleed, 0.0, 1.0);
  float a = inFrame.x * inFrame.y * inImg.x * inImg.y;
  // lens vignetting correction in linear light, radius measured on the source image
  float rv = length(p - ic) / length(ic);
  float vt = smoothstep(uVigMid, 1.0, rv);
  float gain = max(1.0 + uVigFix * vt * vt * 2.0, 0.0);
  outColor = vec4(col.rgb * gain * a, a);
}
