import fs from "fs";
import path from "path";

// Function to replace text in file
function replaceInFile(filePath, searchRegex, replacement) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, "utf-8");
  content = content.replace(searchRegex, replacement);
  fs.writeFileSync(fullPath, content);
}

const replacements = [
  {
    file: "src/app/(dashboard)/calendar/calendar-view.tsx",
    reps: [
      { s: /PanelRightClose,\s*/g, r: "" },
      { s: /const triggerRefresh = useCallback\(\(\) => \{/g, r: "const _triggerRefresh = useCallback(() => {" },
      { s: /\[triggerRefresh\]/g, r: "[_triggerRefresh]" }
    ]
  },
  {
    file: "src/app/(dashboard)/follow-ups/page.tsx",
    reps: [
      { s: /catch \(err\)/g, r: "catch (_err)" },
      { s: /const today = new Date\(\);\n/g, r: "" }
    ]
  },
  {
    file: "src/app/(dashboard)/page.tsx",
    reps: [
      { s: /UserCheck,\n/g, r: "" },
      { s: /UserX,\n/g, r: "" },
      { s: /UserCheck,/g, r: "" },
      { s: /UserX,/g, r: "" }
    ]
  },
  {
    file: "src/app/(dashboard)/search/page.tsx",
    reps: [
      { s: /import { Button } from "@\/components\/ui\/button";\n/g, r: "" }
    ]
  },
  {
    file: "src/app/(dashboard)/settings/page.tsx",
    reps: [
      { s: /import { Separator } from "@\/components\/ui\/separator";\n/g, r: "" }
    ]
  },
  {
    file: "src/app/api/daily-calendar/route.ts",
    reps: [
      { s: /export async function POST\(request: Request\)/g, r: "export async function POST(_request: Request)" }
    ]
  },
  {
    file: "src/app/onboarding/[token]/page.tsx",
    reps: [
      { s: /Sparkles,\s*/g, r: "" }
    ]
  },
  {
    file: "src/components/clients/contact-detail-view.tsx",
    reps: [
      { s: /CheckSquare,\n/g, r: "" },
      { s: /CardHeader,\n/g, r: "" },
      { s: /CardTitle,\n/g, r: "" },
      { s: /CheckSquare,/g, r: "" },
      { s: /CardHeader,/g, r: "" },
      { s: /CardTitle,/g, r: "" },
      { s: /const statusBadgeMap/g, r: "const _statusBadgeMap" } // Just to suppress the warning without deleting it in case it's used elsewhere
    ]
  }
];

for (const { file, reps } of replacements) {
  for (const { s, r } of reps) {
    replaceInFile(file, s, r);
  }
}

console.log("Unused vars removed.");
