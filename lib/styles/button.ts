type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md';

const base = 'rounded-lg transition-colors inline-flex items-center justify-center font-medium';

const variants: Record<Variant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  secondary: 'glass-panel text-gray-300 hover:text-white',
  ghost: 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
};

export function buttonStyles(variant: Variant = 'primary', size: Size = 'md'): string {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}
