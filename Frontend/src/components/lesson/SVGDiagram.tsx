import { useMemo } from "react";

interface Props {
  code: string;
}

const sanitizeSvg = (svg: string): string => {
  let clean = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s(href|xlink:href)\s*=\s*"javascript:[^"]*"/gi, "");
  const match = clean.match(/<svg[\s\S]*<\/svg>/i);
  return match ? match[0] : clean;
};

export const extractSvgBlocks = (content: string): string[] => {
  let s = content;
  s = s.replace(/!\[[^\]]*\]\(\s*svg\s*\r?\n?/gi, "");
  s = s.replace(/<\/svg>\s*\)/gi, "</svg>");
  s = s.replace(/```svg\s*\r?\n?\s*<svg/gi, "<svg");
  s = s.replace(/<\/svg>\s*\r?\n?\s*```/gi, "</svg>");
  const matches = s.match(/<svg[\s\S]*?<\/svg>/gi);
  return matches ? matches : [];
};

const SVGDiagram = ({ code }: Props) => {
  const svg = useMemo(() => sanitizeSvg(code), [code]);

  return (
    <div className="my-6 flex justify-center">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-x-auto max-w-full">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
};

export default SVGDiagram;
