import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const repoRoot = process.cwd();
const outputDir = resolve(repoRoot, ".ontoly");
const tempRoot = mkdtempSync(join(tmpdir(), "bennett-homeschool-ontoly-"));

function run(command, args, options = {}) {
  let executable = process.platform === "win32" && command === "git" ? "git.exe" : command;
  let commandArgs = args;
  if (command === "pnpm" && process.env.npm_execpath) {
    executable = process.execPath;
    commandArgs = [process.env.npm_execpath, ...args];
  } else if (process.platform === "win32" && command === "pnpm") {
    executable = "pnpm.cmd";
  }

  const result = spawnSync(executable, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    stdio: options.stdio ?? "pipe"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

try {
  const trackedFiles = run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter(Boolean)
    .filter((file) => !file.startsWith(".next") && !file.startsWith(".ontoly") && !file.startsWith("ontoly-output"));

  for (const file of trackedFiles) {
    const source = join(repoRoot, file);
    const destination = join(tempRoot, file);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }

  run("pnpm", ["exec", "ontoly", "build", tempRoot, "--output", outputDir], { stdio: "inherit" });
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
