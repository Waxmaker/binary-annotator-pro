import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, TrendingUp, Zap } from 'lucide-react';
import { findHexPattern, findRepeatingPattern, findLeadBlocks } from '@/utils/searchPatterns';
import { formatAddress } from '@/utils/binaryUtils';
import { toast } from 'sonner';

interface PatternFinderProps {
  buffer: ArrayBuffer | null;
  onJumpToOffset: (offset: number) => void;
}

export function PatternFinder({ buffer, onJumpToOffset }: PatternFinderProps) {
  const [hexPattern, setHexPattern] = useState('FF FF 11');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ offset: number; type: string }>>([]);

  const handleSearchPattern = () => {
    if (!buffer) {
      toast.error('No file loaded');
      return;
    }

    setSearching(true);
    try {
      const matches = findHexPattern(buffer, hexPattern);
      setResults(matches.map(m => ({ offset: m.offset, type: 'pattern' })));
      toast.success(`Found ${matches.length} matches`);
    } catch (e) {
      toast.error('Invalid hex pattern');
    } finally {
      setSearching(false);
    }
  };

  const handleFindRepeating = () => {
    if (!buffer) {
      toast.error('No file loaded');
      return;
    }

    setSearching(true);
    try {
      const patterns = findRepeatingPattern(buffer, 2, 8, 3);
      const allOffsets = patterns.flatMap(p => 
        p.offsets.map(offset => ({ offset, type: 'repeating' }))
      );
      setResults(allOffsets.slice(0, 100)); // Limit to 100 results
      toast.success(`Found ${patterns.length} repeating patterns`);
    } catch (e) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleFindLeads = () => {
    if (!buffer) {
      toast.error('No file loaded');
      return;
    }

    setSearching(true);
    try {
      const blocks = findLeadBlocks(buffer, 12, 1000);
      setResults(blocks.map(b => ({ offset: b.offset, type: 'lead' })));
      toast.success(`Found ${blocks.length} potential lead blocks`);
    } catch (e) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card className="p-4 space-y-4 bg-card/50">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Pattern Finder</h3>
      </div>

      {/* Hex Pattern Search */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Hex Pattern</label>
        <div className="flex gap-2">
          <Input
            value={hexPattern}
            onChange={(e) => setHexPattern(e.target.value)}
            placeholder="FF FF 11"
            className="font-mono text-xs h-8"
          />
          <Button
            size="sm"
            onClick={handleSearchPattern}
            disabled={searching || !buffer}
            className="h-8"
          >
            {searching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Quick Analysis</label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleFindRepeating}
            disabled={searching || !buffer}
            className="flex-1 h-8 text-xs"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            Repeating
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFindLeads}
            disabled={searching || !buffer}
            className="flex-1 h-8 text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            ECG Leads
          </Button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">
              Results ({results.length})
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setResults([])}
              className="h-6 text-xs"
            >
              Clear
            </Button>
          </div>
          <div className="max-h-48 overflow-auto space-y-1">
            {results.map((result, i) => (
              <Card
                key={i}
                className="p-2 cursor-pointer hover:bg-accent/10 transition-colors"
                onClick={() => onJumpToOffset(result.offset)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-hex-address">
                    {formatAddress(result.offset)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {result.type}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
