import { useEffect, useRef, useState } from "react";
import type { Run } from "./game";
export function PickupNotice({ run }: { run: Run }) {
  const seen = useRef(new Set<number>());
  const [notice, setNotice] = useState<{ label: string; at: number } | null>(
    null,
  );
  const count = run.items.filter((i) => i.taken).length;
  useEffect(() => {
    const fresh = run.items.find((i) => i.taken && !seen.current.has(i.id));
    run.items.filter((i) => i.taken).forEach((i) => seen.current.add(i.id));
    if (fresh)
      setNotice({
        label:
          {
            cutter: "PULSE CUTTER",
            cell: "ENERGY CELL",
            fuse: "POWER CARTRIDGE",
            medkit: "MEDICAL SUPPLIES",
            artifact: "NEURAL ARTIFACT",
            log: "ARCHIVE RECORD",
          }[fresh.kind] + " ACQUIRED",
        at: run.elapsed,
      });
  }, [count, run]);
  return (
    <div className="pickup-notice" role="status">
      {notice && run.elapsed - notice.at < 2.5 ? `+ ${notice.label}` : ""}
    </div>
  );
}
