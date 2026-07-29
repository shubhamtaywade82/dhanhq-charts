const { execSync } = require("child_process");
try {
  execSync("npx tsx server/index.ts", { stdio: "inherit" });
} catch (e) {
  process.exit(1);
}
