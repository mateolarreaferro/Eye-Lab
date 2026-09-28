// Dichoptic "frequency patching" filter, after Sinha lab's "Perceive More By
// Seeing Less": high-pass filter that removes the low spatial frequencies a
// dominant eye normally leans on. Same math as eye_lab/shaders/filter.gdshader
// mode 1, but applied to ONE eye only (VIEW_INDEX-gated) instead of the whole
// screen, so the headset can rebalance the two eyes instead of patching one
// shut. See vr_game/README.md.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_test_disabled, blend_mix, shadows_disabled;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
// 0 = left only, 1 = right only, 2 = both eyes (bilateral / binocular training mode)
uniform int filtered_eye = 0;
uniform float lod = 3.0;       // blur scale = 2^lod px; higher = lower cutoff frequency
uniform float gain = 1.6;

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
	if (filtered_eye != 2 && int(VIEW_INDEX) != filtered_eye) {
		discard;  // untreated eye: quad contributes nothing, scene shows through clean
	}
	vec2 uv = SCREEN_UV;
	// Spatial shaders have no SCREEN_PIXEL_SIZE built-in (that's canvas_item-only);
	// derive texel size from the screen texture itself instead.
	vec2 px = 1.0 / vec2(textureSize(screen_tex, 0));
	vec3 c = textureLod(screen_tex, uv, 0.0).rgb;
	ALBEDO = vec3(0.5) + (c - blurred(uv, px)) * gain;
}
