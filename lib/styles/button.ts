type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

const base = 'rounded-lg transition-colors inline-flex items-center justify-center';

const variants: Record<Variant, string> = {
  primary: 'bg-blue-500 hover:bg-blue-400 text-white font-medium',
  secondary: 'glass-panel text-gray-300 hover:text-white',
  ghost: 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white',
};

const sizes: Record<Size, string> = {
  sm: 'px-4 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
};

export function buttonStyles(variant: Variant = 'primary', size: Size = 'md'): string {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}
