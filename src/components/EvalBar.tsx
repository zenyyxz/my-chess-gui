

interface EvalBarProps {
    evaluation: string;
}

export function EvalBar({ evaluation }: EvalBarProps) {
    let whitePercentage = 50;
    let val = 0;
    let isMate = false;

    if (evaluation.includes('M')) {
        isMate = true;
        if (evaluation.startsWith('+')) {
            whitePercentage = 100;
        } else {
            whitePercentage = 0;
        }
    } else {
        val = parseFloat(evaluation);
        if (!isNaN(val)) {
            // Use atan to create a smooth curve where 0 cp = 50%, and +/- 3 (300 cp) = ~85%
            // atan(eval / 1.5) scales it nicely
            whitePercentage = (Math.atan(val / 1.5) / (Math.PI / 2)) * 50 + 50;
            whitePercentage = Math.max(0, Math.min(100, whitePercentage));
        }
    }

    const isWhiteWinning = isMate ? evaluation.startsWith('+') : val >= 0;

    return (
        <div className="w-5 h-full bg-[#333333] rounded-md overflow-hidden flex flex-col justify-end relative select-none shadow-inner border border-white/5 flex-shrink-0">
            <div
                className="w-full bg-[#e0e0e0] transition-all duration-500 ease-out"
                style={{ height: `${whitePercentage}%` }}
            />

            {/* Advantage text */}
            <div
                className={`absolute inset-x-0 flex justify-center text-[9px] font-bold z-10 font-mono ${isWhiteWinning ? 'bottom-2 text-[#333333]' : 'top-2 text-[#e0e0e0]'
                    }`}
            >
                {evaluation === '0.00' ? '0.0' : evaluation.replace('+', '')}
            </div>
        </div>
    );
}
