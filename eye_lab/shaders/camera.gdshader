// Webcam feed to RGB. macOS delivers separate Y and CbCr planes.
shader_type canvas_item;

uniform sampler2D y_tex : filter_linear;
uniform sampler2D cbcr_tex : filter_linear;
uniform bool is_ycbcr = true;
uniform bool mirror = true;

void fragment() {
	vec2 uv = UV;
	if (mirror) {
		uv.x = 1.0 - uv.x;
	}
	if (is_ycbcr) {
		float y = texture(y_tex, uv).r;
		vec2 cbcr = texture(cbcr_tex, uv).rg - vec2(0.5);
		COLOR = vec4(y + 1.402 * cbcr.y,
			y - 0.344136 * cbcr.x - 0.714136 * cbcr.y,
			y + 1.772 * cbcr.x, 1.0);
	} else {
		COLOR = vec4(texture(y_tex, uv).rgb, 1.0);
	}
}
