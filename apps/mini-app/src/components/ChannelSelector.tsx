import type { SourceChannel } from '../types';

const listStyle: React.CSSProperties = {
  maxHeight: 240,
  overflowY: 'auto',
  border: '1px solid var(--hint-color)',
  borderRadius: 8,
  padding: 8,
  backgroundColor: 'var(--secondary-bg-color)',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 4px',
  fontSize: 14,
};

const countStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--hint-color)',
  marginTop: 4,
  textAlign: 'right',
};

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
      <div style={listStyle}>
        {channels.length === 0 && (
          <p className="hint" style={{ padding: 8 }}>
            No channels available
          </p>
        )}
        {channels.map((ch) => {
          const checked = selectedIds.has(ch.id);
          const disabled = !checked && atMax;
          return (
            <label key={ch.id} style={{ ...itemStyle, opacity: disabled ? 0.5 : 1 }}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(ch.id)}
                aria-label={ch.username}
                style={{ width: 'auto' }}
              />
              <span>
                @{ch.username}
                {ch.title && <span className="hint"> — {ch.title}</span>}
              </span>
            </label>
          );
        })}
      </div>
      <div style={countStyle}>
        {selectedIds.size} / {maxChannels}
      </div>
    </div>
  );
}
