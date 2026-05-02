import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { legalDocumentBySlug } from '../../content/legal';
import { cn } from '../../lib/cn';

interface LegalAgreementCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  documentSlugs: readonly string[];
  children?: ReactNode;
  className?: string;
}

const joinWithCommas = (items: ReactNode[]) =>
  items.flatMap((item, index) => {
    if (index === 0) {
      return [item];
    }

    if (index === items.length - 1) {
      return [' and ', item];
    }

    return [', ', item];
  });

export const LegalDocumentLinks = ({ documentSlugs }: { documentSlugs: readonly string[] }) => {
  const links = documentSlugs.map((slug) => {
    const document = legalDocumentBySlug.get(slug);
    return (
      <Link
        key={slug}
        to={`/legal/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-brand underline underline-offset-4 hover:text-brand/80"
      >
        {document?.title ?? slug}
      </Link>
    );
  });

  return <>{joinWithCommas(links)}</>;
};

export const LegalAgreementCheckbox = ({
  id,
  checked,
  onChange,
  documentSlugs,
  children,
  className
}: LegalAgreementCheckboxProps) => (
  <label
    htmlFor={id}
    className={cn(
      'flex gap-3 rounded-lg border border-stroke bg-surface-raised/70 px-4 py-3 text-sm leading-6 text-copy-muted',
      className
    )}
  >
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-1 h-4 w-4 shrink-0 accent-brand"
      required
    />
    <span>
      {children ?? (
        <>
          I have read and agree to the <LegalDocumentLinks documentSlugs={documentSlugs} />.
        </>
      )}
    </span>
  </label>
);
