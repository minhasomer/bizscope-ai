
import React, { useEffect, useState } from 'react';

interface LoaderProps {
  message?: string;
  messages?: string[];
  durationCopy?: string;
}

export const REPORT_LOADING_MESSAGES = [
  "Looking for opportunities before everyone else finds them.",
  "Digging into the numbers so you don't have to dig deeper into your pockets.",
  "Good business decisions take a little longer than bad ones.",
  "Checking market signals, competition, and local data.",
  "Turning research into something you can actually use.",
];

export const Loader: React.FC<LoaderProps> = ({ message, messages, durationCopy }) => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!messages?.length) return;
    const id = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length);
    }, 3000);
    return () => clearInterval(id);
  }, [messages]);

  const displayMessage = messages?.length
    ? messages[msgIndex]
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
        key={messages?.length ? msgIndex : 'static'}
        className={`text-xs text-gray-400 font-medium text-center max-w-xs leading-relaxed min-h-[32px] ${messages?.length ? 'animate-fade-in' : 'animate-pulse'}`}
      >
        {displayMessage}
      </p>
      {durationCopy && (
        <p className="mt-1.5 text-xs text-gray-300 text-center font-medium">
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
