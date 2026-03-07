"use client";

import { motion } from "framer-motion";

interface ItemTrackerProps {
  label: string;
  checked: number;
  total: number;
  onToggle: (index: number) => void;
}

export default function ItemTracker({ label, checked, total, onToggle }: ItemTrackerProps) {
  const allDone = checked >= total;

  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm font-semibold ${allDone ? "line-through opacity-50" : ""}`}>
        {label} <span className="font-normal opacity-50">({checked}/{total})</span>
      </span>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const isFilled = i < checked;
          const isNextToCheck = i === checked;
          const isLastChecked = i === checked - 1;
          const isInteractive = isNextToCheck || isLastChecked;

          return (
            <motion.button
              key={i}
              type="button"
              disabled={!isInteractive}
              onClick={() => isInteractive && onToggle(i)}
              whileTap={isInteractive ? { scale: 0.75 } : undefined}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className={`
                w-[32px] h-[32px] min-w-[28px] min-h-[28px]
                rounded-full border-[2.5px]
                transition-colors duration-200
                flex items-center justify-center text-xs font-bold
                ${isFilled
                  ? isLastChecked
                    ? "bg-[#FFD166] border-[#FFD166] text-[#3D3D3D] cursor-pointer"
                    : "bg-[#FFD166] border-[#FFD166] text-[#3D3D3D] cursor-default"
                  : isNextToCheck
                    ? "bg-transparent border-[#00A896] text-[#00A896] cursor-pointer"
                    : "bg-transparent border-[#00A896]/25 text-[#00A896]/25 cursor-default"
                }
              `}
              aria-label={`${label} ${i + 1} of ${total}${isFilled ? " (checked)" : isNextToCheck ? " (tap to check)" : " (locked)"}`}
            >
              {isFilled ? "✓" : ""}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
