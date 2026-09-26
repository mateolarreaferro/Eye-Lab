// Sine (or square) grating in a disk, or a Gabor patch on mid-grey.
// angle_deg = 0 gives vertical bars; +45 leans the bars like "/".
shader_type canvas_item;

uniform float cycles = 6.0;        // cycles across the rect width
uniform float angle_deg = 0.0;
uniform float contrast = 1.0;      // Michelson contrast, 0..1
uniform float phase = 0.0;
uniform bool square_wave = false;
uniform bool gabor = false;        // Gaussian envelope on grey instead of a hard disk

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	vec2 p = UV - 0.5;
	float r = length(p);
	float a = radians(angle_deg);
	float x = p.x * cos(a) + p.y * sin(a);
	float w = sin(TAU * cycles * x + phase);
	if (square_wave) {
		w = sign(w);
	}
	// Dither so very low contrasts are not lost to 8-bit quantisation.
	float dither = (hash(FRAGCOORD.xy) - 0.5) / 255.0;
	if (gabor) {
		float env = exp(-(r * r) / (2.0 * 0.15 * 0.15));
		COLOR = vec4(vec3(0.5 + 0.5 * contrast * w * env + dither), 1.0);
	} else {
		float disk = 1.0 - smoothstep(0.48, 0.5, r);
		COLOR = vec4(vec3(0.5 + 0.5 * contrast * w + dither), disk);
	}
}
