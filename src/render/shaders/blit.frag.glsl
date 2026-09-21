#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uSize;
out vec4 outColor;
void main() { outColor = texture(uTex, gl_FragCoord.xy / uSize); }
