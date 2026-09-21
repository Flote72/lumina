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
out vec4 outColor;

void main() {
  vec2 v = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  vec2 o = (v - uSize * 0.5 - uPan) / uZoom;
  float c = cos(-uAngle), s = sin(-uAngle);
  vec2 p = uC + vec2(o.x * c - o.y * s, o.x * s + o.y * c);
  vec2 uv = p / uImg;
  vec4 col = texture(uSrc, uv); // sampled in uniform control flow (mip derivatives)

  vec2 inFrame = clamp((uHalf - abs(o)) * uZoom + 0.5, 0.0, 1.0);
  vec2 inImg = clamp(min(p, uImg - p) * uZoom + 0.5, 0.0, 1.0);
  float a = inFrame.x * inFrame.y * inImg.x * inImg.y;
  outColor = vec4(col.rgb * a, a);
}
