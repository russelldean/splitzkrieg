interface Props {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeading({ children, className = '' }: Props) {
  return (
    <div className={`mb-4 ${className}`}>
      <h2 className="font-heading text-2xl text-navy">{children}</h2>
      <span className="block w-10 h-0.5 bg-red-600/40 mt-1.5" />
    </div>
  );
}
