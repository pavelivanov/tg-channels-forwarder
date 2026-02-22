import { useState } from 'react';
import type { SourceChannel } from '../types';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ChannelSelectorProps {
  channels: SourceChannel[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  maxChannels?: number;
}

export function ChannelSelector({
  channels,
  selectedIds,
  onToggle,
  maxChannels = 30,
}: ChannelSelectorProps) {
  const [search, setSearch] = useState('');
  const atMax = selectedIds.size >= maxChannels;

  const filtered = channels.filter((ch) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      ch.username.toLowerCase().includes(term) ||
      (ch.title?.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div>
      <Input
        placeholder="Search channels..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2"
      />
      <div className="max-h-60 overflow-y-auto border rounded-lg p-2 bg-secondary">
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-sm p-2">
            {channels.length === 0 ? 'No channels available' : 'No channels match your search'}
          </p>
        )}
        {filtered.map((ch) => {
          const checked = selectedIds.has(ch.id);
          const disabled = !checked && atMax;
          return (
            <Label
              key={ch.id}
              className={`flex items-center gap-2 py-1.5 px-1 text-sm cursor-pointer ${disabled ? 'opacity-50' : ''}`}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => onToggle(ch.id)}
                aria-label={ch.username}
              />
              <span>
                @{ch.username}
                {ch.title && <span className="text-muted-foreground"> — {ch.title}</span>}
              </span>
            </Label>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground mt-1 text-right">
        {selectedIds.size} / {maxChannels}
      </div>
    </div>
  );
}
