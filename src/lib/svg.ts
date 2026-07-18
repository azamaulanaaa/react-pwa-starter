export type ImageGeneratorOption = {
  bg_color: string;
  text_color: string;
};

export function ImageGenerator(
  width: number,
  height: number,
  text: string = `${width}×${height}`,
  options: ImageGeneratorOption = {
    bg_color: "#E2E8F0",
    text_color: "#4A5568",
  },
) {
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="${options.bg_color}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" font-size="${
    Math.max(12, width * 0.05)
  }px" fill="${options.text_color}">
        ${text}
      </text>
    </svg>
  `.trim();

  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

  return blob;
}
