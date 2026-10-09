// Full-screen spatial-frequency filters, applied on top of everything the lab draws.
// Modes follow "Perceive More By Seeing Less": 1 high-pass ("frequency patching":
// removes the low spatial frequencies that dominate), 2 low-pass.
shader_type canvas_item;
render_mode unshaded;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform int mode = 1;
uniform float lod = 3.0;       // blur scale = 2^lod px; higher = lower cutoff frequency
uniform float gain = 1.6;      // high-pass contrast gain
uniform float keep = 0.0;      // high-pass: share of the coarse image kept (0 = pure high-pass)
uniform float amount = 1.0;    // low-pass: 0 = original, 1 = fully blurred

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
		vec3 b = blurred(uv, px);
		o = vec3(0.5) + (c - b) * gain + (b - vec3(0.5)) * keep;
	} else if (mode == 2) {
		o = mix(c, blurred(uv, px), amount);
	}
	COLOR = vec4(o, 1.0);
}
