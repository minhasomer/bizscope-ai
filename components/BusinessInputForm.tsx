
import React, { useState } from 'react';

interface BusinessInputFormProps {
  onSubmit: (businessType: string, location: string) => void;
  isLoading: boolean;
}

export const BusinessInputForm: React.FC<BusinessInputFormProps> = ({ onSubmit, isLoading }) => {
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessType.trim() && location.trim()) {
      onSubmit(businessType, location);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="businessType" className="block text-sm font-medium text-gray-700">
          Business Type
        </label>
        <div className="mt-1">
          <input
            type="text"
            name="businessType"
            id="businessType"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="e.g., Artisanal Coffee Shop"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700">
          City, State, or ZIP Code
        </label>
        <div className="mt-1">
          <input
            type="text"
            name="location"
            id="location"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="e.g., Brooklyn, NY"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isLoading || !businessType || !location}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Analyzing...' : 'Generate Viability Report'}
        </button>
      </div>
    </form>
  );
};
