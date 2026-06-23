
import React, { useEffect, useState } from 'react';

/** A loading message and the elapsed-second mark at which it starts showing. */
interface LoadingPhase {
  at: number;
  text: string;
}

interface LoaderProps {
  message?: string;
  messages?: LoadingPhase[];
  durationCopy?: string;
}

// Time-phased loading copy: concrete research steps early, calm reassurance as
// the wait lengthens. Tone is professional and lightly human — no jokes or
// anthropomorphised AI — so a user evaluating a six-figure decision feels
// reassured, not entertained. Shared by the viability and Market Gap loaders.
export const REPORT_LOADING_MESSAGES: LoadingPhase[] = [
  { at: 0,  text: "Checking market signals, competition, and local data." },
  { at: 9,  text: "Analyzing competitors and local demand." },
  { at: 20, text: "Researching financial benchmarks and demographics." },
  { at: 32, text: "Turning the research into projections and risk factors." },
  { at: 44, text: "Compiling your detailed market analysis." },
  { at: 56, text: "Still working — we'd rather be thorough than confidently wrong." },
  { at: 72, text: "Almost there — double-checking assumptions before we finalize recommendations." },
];

export const Loader: React.FC<LoaderProps> = ({ message, messages, durationCopy }) => {
  const [elapsedSec, setElapsedSec] = useState(0);

  // Drive messaging from real elapsed time so it progresses logically as the
  // wait grows (rather than cycling on a fixed loop regardless of duration).
  useEffect(() => {
    if (!messages?.length) return;
    const start = Date.now();
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [messages]);

  // Latest phase whose start time has passed; holds on the final reassurance
  // message for long runs.
  const phases = messages ?? [];
  const activePhase: LoadingPhase | null = phases.length
    ? phases.reduce((current, phase) => (elapsedSec >= phase.at ? phase : current), phases[0])
    : null;

  const displayMessage = activePhase
    ? activePhase.text
    : (message || 'Evaluating demand, competition & revenue potential...');

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 animate-fade-in">
      {/* Spinner ring */}
      <div className="relative w-14 h-14 mb-6">
        <div className="absolute inset-0 rounded-full border-[3px] border-gray-100" />
        <div className="absolute inset-0 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
        <div className="absolute inset-[5px] rounded-full bg-blue-50 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
        </div>
      </div>

      <h3 className="text-sm font-black text-gray-900 tracking-tight mb-1.5 uppercase">
        Analyzing Market Conditions
      </h3>
      <p
        key={activePhase ? activePhase.at : 'static'}
        className={`text-sm text-gray-600 font-medium text-center max-w-sm leading-relaxed min-h-[40px] ${activePhase ? 'animate-fade-in' : 'animate-pulse'}`}
      >
        {displayMessage}
      </p>
      {durationCopy && (
        <p className="mt-1.5 text-xs text-gray-500 text-center font-medium">
          {durationCopy}
        </p>
      )}

      {/* Skeleton preview */}
      <div className="mt-10 w-full max-w-md space-y-4">
        <div className="space-y-2.5">
          <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-3/4" />
          <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-full" />
          <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-5/6" />
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
        <div className="space-y-2.5 pt-1">
          <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-4/5" />
          <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-2/3" />
        </div>
      </div>
    </div>
  );
};
