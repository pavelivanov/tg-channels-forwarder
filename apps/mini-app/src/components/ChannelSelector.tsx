import type { SourceChannel } from '../types';
import { Checkbox } from '@/components/ui/checkbox';
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
  const atMax = selectedIds.size >= maxChannels;

  return (
    <div>
      <div className="max-h-60 overflow-y-auto rounded-lg border bg-secondary p-2">
        {channels.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">
            No channels available
          </p>
        )}
        {channels.map((ch) => {
          const checked = selectedIds.has(ch.id);
          const disabled = !checked && atMax;
          return (
            <div key={ch.id} className={`flex items-center gap-2 px-1 py-1.5 text-sm${disabled ? ' opacity-50' : ''}`}>
              <Checkbox
                id={`channel-${ch.id}`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => onToggle(ch.id)}
                aria-label={ch.username}
              />
              <Label htmlFor={`channel-${ch.id}`} className="font-normal cursor-pointer">
                @{ch.username}
                {ch.title && <span className="text-muted-foreground"> — {ch.title}</span>}
              </Label>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground mt-1 text-right">
        {selectedIds.size} / {maxChannels}
      </div>
    </div>
  );
}
