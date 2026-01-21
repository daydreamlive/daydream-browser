import { readdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main() {
  try {
    const examplesDir = join(root, "public", "three", "examples");
    const files = await readdir(examplesDir);

    const examples = files
      .filter((f) => f.startsWith("webgl_") && f.endsWith(".html"))
      .map((f) => f.replace(".html", ""))
      .sort();

    const outputPath = join(root, "public", "examples.json");
    await writeFile(outputPath, JSON.stringify(examples, null, 2));

    console.log(`Generated ${outputPath} with ${examples.length} examples`);
  } catch (err) {
    console.error("Failed to generate examples list:", err);
    process.exit(1);
  }
}

main();
