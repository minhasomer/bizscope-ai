
import React from 'react';

interface LoaderProps {
  message?: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
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
      <p className="text-xs text-gray-400 font-medium text-center max-w-xs leading-relaxed min-h-[32px] animate-pulse">
        {message || 'Evaluating demand, competition & revenue potential...'}
      </p>

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
