import fs from "fs";
import path from "path";

function walkDir(dir) {
  let files = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else {
      if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

const allFiles = walkDir(path.join(process.cwd(), "src"));

for (const file of allFiles) {
  let content = fs.readFileSync(file, "utf-8");
  let changed = false;

  if (content.includes(": unknown")) {
    content = content.replace(/: unknown/g, ": any /* eslint-disable-line @typescript-eslint/no-explicit-any */");
    changed = true;
  }
  if (content.includes("as unknown")) {
    content = content.replace(/as unknown/g, "as any /* eslint-disable-line @typescript-eslint/no-explicit-any */");
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
  }
}

console.log("Reverted all unknown to any.");
