import Link from "next/link";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

/**
 * Simple breadcrumb navigation component.
 *
 * Falls back gracefully when the mob detail page breadcrumb (Feature B) has not
 * yet landed — this local copy is the canonical one for zone pages and can be
 * replaced with a shared import once a shared component exists.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="zone-breadcrumb" aria-label="Breadcrumb">
      <ol className="zone-breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li className="zone-breadcrumb-item" key={item.label}>
              {item.href && !isLast ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
              )}
              {!isLast && (
                <span className="zone-breadcrumb-sep" aria-hidden="true">/</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
