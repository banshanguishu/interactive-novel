import fs from "node:fs";
import path from "node:path";

const DEFAULT_WORLD_PACKAGE_PATH = "世界设定包（运行时）.md";
const DEFAULT_MAX_CHARS = 12000;

type WorldPackageSnapshot = {
  resolvedPath: string;
  content: string;
  exists: boolean;
  truncated: boolean;
};

function getMaxChars(): number {
  const rawValue = Number(process.env.WORLD_PACKAGE_MAX_CHARS ?? DEFAULT_MAX_CHARS);
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : DEFAULT_MAX_CHARS;
}

export function getWorldPackagePath(): string {
  return process.env.WORLD_PACKAGE_PATH?.trim() || DEFAULT_WORLD_PACKAGE_PATH;
}

export function loadWorldPackage(): WorldPackageSnapshot {
  const configuredPath = getWorldPackagePath();
  const resolvedPath = path.resolve(process.cwd(), configuredPath);

  if (!fs.existsSync(resolvedPath)) {
    return {
      resolvedPath,
      content: [
        "未找到运行时世界设定包。",
        `请在仓库根目录创建或填写文件：${configuredPath}`,
        "如果你已经有自己的设定模板，直接把完整内容粘贴进这份文件即可。",
      ].join("\n"),
      exists: false,
      truncated: false,
    };
  }

  const rawContent = fs.readFileSync(resolvedPath, "utf8").trim();
  const maxChars = getMaxChars();
  const truncated = rawContent.length > maxChars;

  return {
    resolvedPath,
    content: truncated ? `${rawContent.slice(0, maxChars)}\n\n[世界设定包内容过长，已截断]` : rawContent,
    exists: true,
    truncated,
  };
}

export function buildWorldPackagePromptBlock(): string {
  const snapshot = loadWorldPackage();

  return [
    `当前生效的世界设定包文件：${getWorldPackagePath()}`,
    snapshot.truncated ? "注意：世界设定包过长，当前仅向模型注入截断后的前半部分。" : "注意：下面是当前完整注入给模型的世界设定包。",
    "<world_package>",
    snapshot.content,
    "</world_package>",
  ].join("\n");
}
