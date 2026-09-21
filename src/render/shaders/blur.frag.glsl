#version 300 es
precision highp float;
// 13-tap separable gaussian; tap spacing scales with sigma so ±2σ is always covered.
uniform sampler2D uTex;
uniform vec2 uSize;
uniform vec2 uDir;
uniform float uSigma; // px
out vec4 outColor;
void main() {
  float step = max(uSigma / 3.0, 0.25);
  vec2 uv = gl_FragCoord.xy / uSize;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -6; i <= 6; i++) {
    float d = float(i) * step;
    float w = exp(-(d * d) / (2.0 * uSigma * uSigma));
    acc += texture(uTex, uv + uDir * d / uSize) * w;
    wsum += w;
  }
  outColor = acc / wsum;
}
