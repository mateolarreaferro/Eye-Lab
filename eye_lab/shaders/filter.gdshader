// Full-screen spatial-frequency filters, applied on top of everything the lab draws.
// Modes follow "Perceive More By Seeing Less": 1 high-pass ("frequency patching":
// removes the low spatial frequencies that dominate), 2 low-pass, 3 edges
// (special high-pass on black), 4 colour inversion, 5 kaleidoscope.
shader_type canvas_item;
render_mode unshaded;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform int mode = 1;
uniform float lod = 3.0;       // blur scale = 2^lod px; higher = lower cutoff frequency
uniform float gain = 1.6;
uniform float segments = 8.0;

vec3 blurred(vec2 uv, vec2 px) {
	// 3x3 tent filter over the mip level smooths away blocky mip edges.
	vec2 d = px * exp2(lod);
	vec3 s = textureLod(screen_tex, uv, lod).rgb * 4.0;
	s += textureLod(screen_tex, uv + vec2(d.x, 0.0), lod).rgb * 2.0;
	s += textureLod(screen_tex, uv - vec2(d.x, 0.0), lod).rgb * 2.0;
	s += textureLod(screen_tex, uv + vec2(0.0, d.y), lod).rgb * 2.0;
	s += textureLod(screen_tex, uv - vec2(0.0, d.y), lod).rgb * 2.0;
	s += textureLod(screen_tex, uv + d, lod).rgb;
	s += textureLod(screen_tex, uv - d, lod).rgb;
	s += textureLod(screen_tex, uv + vec2(d.x, -d.y), lod).rgb;
	s += textureLod(screen_tex, uv + vec2(-d.x, d.y), lod).rgb;
	return s / 16.0;
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 px = SCREEN_PIXEL_SIZE;
	vec3 c = textureLod(screen_tex, uv, 0.0).rgb;
	vec3 o = c;
	if (mode == 1) {
		o = vec3(0.5) + (c - blurred(uv, px)) * gain;
	} else if (mode == 2) {
		o = blurred(uv, px);
	} else if (mode == 3) {
		o = clamp(abs(c - blurred(uv, px)) * gain * 3.0, 0.0, 1.0);
	} else if (mode == 4) {
		o = vec3(1.0) - c;
	} else if (mode == 5) {
		vec2 aspect = vec2(px.y / px.x, 1.0);
		vec2 p = (uv - 0.5) * aspect;
		float seg = TAU / segments;
		float a = mod(atan(p.y, p.x) + TIME * 0.1, seg);
		a = abs(a - seg * 0.5);
		vec2 q = length(p) * vec2(cos(a), sin(a));
		o = textureLod(screen_tex, clamp(q / aspect + 0.5, 0.0, 1.0), 0.0).rgb;
	}
	COLOR = vec4(o, 1.0);
}
