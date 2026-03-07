"use client";

import { motion } from "framer-motion";

interface KibbleTrackerProps {
  checked: number;
  total: number;
  onToggle: (index: number) => void;
}

export default function KibbleTracker({ checked, total, onToggle }: KibbleTrackerProps) {
  return (
    <div className="grid grid-cols-3 gap-3 justify-items-center">
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
            whileTap={isInteractive ? { scale: 0.8 } : undefined}
            whileHover={isInteractive ? { scale: 1.08 } : undefined}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={`
              w-[60px] h-[60px] min-w-[44px] min-h-[44px]
              rounded-full border-[3px]
              transition-colors duration-200
              flex items-center justify-center text-lg font-bold
              ${isFilled
                ? isLastChecked
                  ? "bg-[#FFD166] border-[#FFD166] text-[#3D3D3D] cursor-pointer"
                  : "bg-[#FFD166] border-[#FFD166] text-[#3D3D3D] cursor-default"
                : isNextToCheck
                  ? "bg-transparent border-[#00A896] text-[#00A896] cursor-pointer ring-2 ring-[#00A896]/30 ring-offset-2"
                  : "bg-transparent border-[#00A896]/25 text-[#00A896]/25 cursor-default"
              }
            `}
            aria-label={`Scoop ${i + 1} of ${total}${isFilled ? " (checked)" : isNextToCheck ? " (tap to check)" : " (locked)"}`}
          >
            {isFilled ? "✓" : i + 1}
          </motion.button>
        );
      })}
    </div>
  );
}
