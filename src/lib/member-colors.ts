export const memberPalette = [
  { name: "Sand", color: "#d2bd9e" },
  { name: "Blue", color: "#aacbd0" },
  { name: "Purple", color: "#cabbce" },
  { name: "Green", color: "#c7d29c" },
  { name: "Orange", color: "#dfb896" },
  { name: "Yellow", color: "#dfd295" },
  { name: "Teal", color: "#a5c9bd" },
  { name: "Rose", color: "#d4adb5" },
  { name: "Clay", color: "#cfa69a" },
  { name: "Lavender", color: "#b9b5d4" },
  { name: "Sage", color: "#aec4aa" },
  { name: "Slate", color: "#b3c2ce" },
] as const;

export function memberColorForeground(color: string) {
  const [r, g, b] = [1, 3, 5].map(offset => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  // Black or white keeps initials readable at WCAG AA contrast for any custom color.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000000" : "#ffffff";
}
