import type { ComponentType, SVGProps } from 'react';
import type { SoundCheckController } from '@/hooks/useSoundCheck';

export type SoundCheckProps = {
  soundCheck: SoundCheckController;
};

export type SectionAccent = 'input' | 'output';
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
