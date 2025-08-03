import { bold, gray, green, red, yellow } from "@std/fmt/colors";

export class Logger {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(message: string) {
    console.log(message);
  }

  success(message: string) {
    console.log(green("✓") + " " + message);
  }

  error(message: string) {
    console.error(red("✗") + " " + message);
  }

  warn(message: string) {
    console.log(yellow("⚠") + " " + message);
  }

  debug(message: string) {
    if (this.verbose) {
      console.log(gray("►") + " " + gray(message));
    }
  }

  bold(text: string): string {
    return bold(text);
  }

  formatCommand(cmd: string): string {
    return bold(cmd);
  }
}
