const args = process.argv.slice(2);

if (!args.includes("--candidate")) {
  process.stderr.write("Generic Golden Demo scoring CLI requires an explicit --candidate GD-001 or --candidate GD-002.\n");
  process.exitCode = 1;
} else {
  require("./score-gd-001.cjs").run(args).catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
