import React from 'react';

/** Maps color family names to their primary hex value. */
const COLOR_HEX: Record<string, string> = {
  emerald: '#059669',
  green:   '#16a34a',
  amber:   '#d97706',
  orange:  '#ea580c',
  rose:    '#e11d48',
};

interface AssessmentDotProps {
  /** Color family — must be a key of COLOR_HEX. */
  color: string;
  /** filled = solid circle; outlined = white center with colored border. */
  variant: 'filled' | 'outlined';
  /** Rendered pixel size (width = height). Defaults to 20. */
  size?: number;
}

/**
 * Platform-invariant SVG circle indicator for assessment tiers.
 * Replaces emoji-based indicators which render inconsistently across OSes.
 *
 * filled  → Strong Opportunity, Proceed Carefully, Caution Advised, Not Recommended
 * outlined → Worth Further Investigation (favorable-but-conditional)
 *
 * aria-hidden="true" because the surrounding label text already communicates
 * the assessment — this is a purely decorative visual indicator.
 */
export const AssessmentDot: React.FC<AssessmentDotProps> = ({ color, variant, size = 20 }) => {
  const hex = COLOR_HEX[color] ?? COLOR_HEX.emerald;
  const isOutlined = variant === 'outlined';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}
    >
      <circle
        cx="10"
        cy="10"
        r={isOutlined ? 8 : 9.5}
        fill={isOutlined ? 'white' : hex}
        stroke={isOutlined ? hex : 'none'}
        strokeWidth={isOutlined ? 2 : 0}
      />
    </svg>
  );
};
