// Frosted glass (iOS "material"): blurs what's behind, tints it, and clips to a
// rounded rectangle with a hairline edge. Drawn by a ColorRect behind a panel's content.
shader_type canvas_item;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform vec2 rect_size = vec2(100.0, 100.0);
uniform float radius = 20.0;
uniform float blur = 4.0;
uniform vec4 tint : source_color = vec4(1.0, 1.0, 1.0, 0.62);
uniform vec4 edge : source_color = vec4(1.0, 1.0, 1.0, 0.7);
uniform float saturation = 1.35;

float sd_round_box(vec2 p, vec2 b, float r) {
	vec2 q = abs(p) - b + r;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void fragment() {
	vec2 p = (UV - 0.5) * rect_size;
	// Inset by a pixel so the hairline outline below fits inside the rect.
	float d = sd_round_box(p, rect_size * 0.5 - 1.0, radius);
	float inside = clamp(0.5 - d, 0.0, 1.0);

	vec2 px = SCREEN_PIXEL_SIZE * exp2(blur);
	vec3 bg = textureLod(screen_tex, SCREEN_UV, blur).rgb * 0.4;
	bg += textureLod(screen_tex, SCREEN_UV + vec2(px.x, 0.0), blur).rgb * 0.15;
	bg += textureLod(screen_tex, SCREEN_UV - vec2(px.x, 0.0), blur).rgb * 0.15;
	bg += textureLod(screen_tex, SCREEN_UV + vec2(0.0, px.y), blur).rgb * 0.15;
	bg += textureLod(screen_tex, SCREEN_UV - vec2(0.0, px.y), blur).rgb * 0.15;
	// Vibrancy: a touch more saturation, like Apple materials.
	float l = dot(bg, vec3(0.299, 0.587, 0.114));
	bg = mix(vec3(l), bg, saturation);

	vec3 col = mix(bg, tint.rgb, tint.a);
	// Bright inner rim + faint dark outer hairline, like macOS materials.
	float rim = clamp(1.0 - abs(d + 0.75), 0.0, 1.0);
	col = mix(col, edge.rgb, rim * edge.a);
	float outline = clamp(1.0 - abs(d - 0.5), 0.0, 1.0) * 0.07;
	COLOR = vec4(col * inside, max(inside, outline));
}
