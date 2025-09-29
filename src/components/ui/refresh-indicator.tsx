import { useState, useEffect } from 'react';

interface RefreshIndicatorProps {
  isLoading?: boolean;
  lastUpdated?: Date;
  refreshInterval?: number;
}

export function RefreshIndicator({ 
  isLoading = false, 
  lastUpdated, 
  refreshInterval = 10000 
}: RefreshIndicatorProps) {
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(refreshInterval / 1000);

  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      setTimeUntilRefresh(prev => {
        if (prev <= 1) {
          return refreshInterval / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
      <span>
        {isLoading ? 'Updating...' : `Next update in ${timeUntilRefresh}s`}
      </span>
      {lastUpdated && (
        <span className="text-xs">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}