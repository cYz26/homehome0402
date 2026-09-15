import { spawnSync } from "node:child_process";
const steps = {
  model: "build-apartment.py",
  export: "export-apartment.py",
  render: "render-apartment.py",
  validate: "validate-apartment.py",
};
const step = steps[process.argv[2]];
if (!step) throw Error("Choose model, export, render or validate.");
const binary =
  process.env.BLENDER_BIN ??
  (process.platform === "darwin"
    ? "/Applications/Blender.app/Contents/MacOS/Blender"
    : "blender");
const result = spawnSync(
  binary,
  [
    "--background",
    "--factory-startup",
    "--disable-autoexec",
    "--python-exit-code",
    "1",
    "--python",
    `scripts/${step}`,
    "--",
    ...process.argv.slice(3),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
