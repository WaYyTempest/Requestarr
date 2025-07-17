import figlet, { Fonts } from "figlet";

// Generate ASCII art from a string using the specified font
export function generateASCII(
  text: string,
  font: Fonts = "ANSI Shadow"
): string {
  return figlet.textSync(text, { font });
}
