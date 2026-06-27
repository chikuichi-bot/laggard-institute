type FramedCatalogProps = {
  children: React.ReactNode;
};

export default function FramedCatalog({ children }: FramedCatalogProps) {
  return <article className="content-card content-card--catalog">{children}</article>;
}
