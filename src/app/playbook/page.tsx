import { RUBRICS, type CallType } from "@/domain/rubric";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlaybookPage() {
  const callTypes = Object.keys(RUBRICS) as CallType[];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">Playbook</h1>
        <p className="text-sm text-neutral-400">
          The opinionated default scorecards. Mid-market finance buyer; edit weights & anchors to fit your motion.
        </p>
      </header>

      {callTypes.map((ct) => {
        const rubric = RUBRICS[ct];
        const sum = rubric.items.reduce((s, i) => s + i.weight, 0);
        return (
          <div key={ct}>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold capitalize">{ct} scorecard</h2>
              <Badge variant={sum === 100 ? "strong" : "redo"}>weights = {sum}</Badge>
            </div>
            <p className="mb-2 px-1 text-xs text-neutral-500">{rubric.talkRatioNote}</p>
            <Card>
              <ul className="divide-y divide-neutral-800">
                {rubric.items.map((it) => (
                  <li key={it.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-100">
                        {it.id}. {it.name}
                        {it.id === rubric.highestSignalItemId && (
                          <Badge variant="needs_work" className="ml-2">highest signal</Badge>
                        )}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-neutral-400">w {it.weight}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-300/80">5/5 — {it.anchorHigh}</p>
                    <p className="text-[11px] text-rose-300/80">1/5 — {it.anchorLow}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        );
      })}

      <p className="pb-2 text-center text-[11px] text-neutral-600">
        Proposal & Close scorecards are researched and ship in the full playbook (SPEC §11). In-app editing is roadmap.
      </p>
    </div>
  );
}
