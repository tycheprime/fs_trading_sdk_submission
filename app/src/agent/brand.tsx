/** Product name shown in headers and document title. */
export const BRAND_TITLE = 'TychePrime x FunctionSPACE';

export function BrandMark({
  accentClassName = 'fs-header-brand-accent',
}: {
  accentClassName?: string;
}) {
  return (
    <>
      TYCHEPRIME <span className={accentClassName}>x FUNCTIONSPACE</span>
    </>
  );
}
