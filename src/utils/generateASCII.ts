import figlet, { Fonts } from "figlet";

export function generateASCII(
  text: string,
  font: Fonts = "ANSI Shadow"
): string {
  return figlet.textSync(text, { font });
}
