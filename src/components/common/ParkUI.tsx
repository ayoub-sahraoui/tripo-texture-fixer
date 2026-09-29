import React from 'react';
import {
  Button as ParkButton,
  IconButton as ParkIconButton,
  Badge as ParkBadge,
  Tooltip as ParkTooltip,
  type ButtonProps as ParkButtonProps,
  type IconButtonProps as ParkIconButtonProps,
  type BadgeProps as ParkBadgeProps,
} from '@/components/ui';
import * as Slider from '@/components/ui/slider';

export interface ButtonProps extends Omit<ParkButtonProps, 'variant'> {
  variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'subtle' | 'primary' | 'secondary' | 'accent' | 'danger';
  active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  active,
  variant = 'outline',
  size = 'sm',
  colorPalette,
  className = '',
  ...props
}) => {
  let mappedVariant: 'solid' | 'outline' | 'ghost' | 'link' | 'subtle' = 'outline';
  let mappedPalette = colorPalette;

  if (variant === 'primary' || variant === 'accent') {
    mappedVariant = 'solid';
  } else if (variant === 'secondary') {
    mappedVariant = 'outline';
  } else if (variant === 'danger') {
    mappedVariant = 'outline';
  } else {
    mappedVariant = variant;
  }

  return (
    <ParkButton
      variant={mappedVariant}
      colorPalette={mappedPalette}
      size={size}
      data-active={active ? '' : undefined}
      className={`${active ? '!bg-zinc-800 !border-zinc-500 !text-white shadow-sm' : ''} ${className}`}
      {...props}
    />
  );
};

export interface IconButtonProps extends Omit<ParkIconButtonProps, 'variant'> {
  variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'subtle' | 'primary' | 'secondary' | 'accent' | 'danger';
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  active,
  variant = 'outline',
  size = 'sm',
  colorPalette,
  className = '',
  ...props
}) => {
  let mappedVariant: 'solid' | 'outline' | 'ghost' | 'link' | 'subtle' = 'outline';
  let mappedPalette = colorPalette;

  if (variant === 'primary' || variant === 'accent') {
    mappedVariant = 'solid';
  } else if (variant === 'secondary') {
    mappedVariant = 'outline';
  } else if (variant === 'danger') {
    mappedVariant = 'outline';
  } else {
    mappedVariant = variant;
  }

  return (
    <ParkIconButton
      variant={mappedVariant}
      colorPalette={mappedPalette}
      size={size}
      data-active={active ? '' : undefined}
      className={`${active ? '!bg-zinc-800 !border-zinc-500 !text-white shadow-sm' : ''} ${className}`}
      {...props}
    />
  );
};

export interface BadgeProps extends Omit<ParkBadgeProps, 'variant'> {
  variant?: 'solid' | 'subtle' | 'outline' | 'accent' | 'default' | 'success' | 'warning';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  colorPalette,
  ...props
}) => {
  let mappedVariant: 'solid' | 'subtle' | 'outline' = 'subtle';

  if (variant === 'accent' || variant === 'solid') {
    mappedVariant = 'solid';
  } else if (variant === 'outline') {
    mappedVariant = 'outline';
  } else {
    mappedVariant = 'subtle';
  }

  return <ParkBadge variant={mappedVariant} colorPalette={colorPalette} size="sm" {...props} />;
};

interface SimpleTooltipProps {
  content: string;
  shortcut?: string;
  children: React.ReactNode;
}

export const SimpleTooltip: React.FC<SimpleTooltipProps> = ({
  content,
  shortcut,
  children,
}) => {
  return (
    <ParkTooltip content={content} shortcut={shortcut}>
      {children}
    </ParkTooltip>
  );
};

interface ParkSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export const ParkSlider: React.FC<ParkSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}) => {
  return (
    <Slider.Root
      size="sm"
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(details) => onChange(details.value[0])}
      className="flex flex-col gap-1 w-full"
    >
      <div className="flex justify-between items-center text-[11px]">
        <Slider.Label className="text-park-text-muted font-medium">{label}</Slider.Label>
        <Slider.ValueText className="font-mono text-neutral-300">
          {value}
          {unit}
        </Slider.ValueText>
      </div>
      <Slider.Control>
        <Slider.Track>
          <Slider.Range />
        </Slider.Track>
        <Slider.Thumb index={0}>
          <Slider.HiddenInput />
        </Slider.Thumb>
      </Slider.Control>
    </Slider.Root>
  );
};
