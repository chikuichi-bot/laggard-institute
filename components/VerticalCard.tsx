type VerticalCardProps = {
  text: string;
  meta?: string;
};

export default function VerticalCard({ text, meta }: VerticalCardProps) {
  return (
    <article className="content-card">
      <div className="text-wrapper">
        <p className="vertical-text">{text}</p>
      </div>
      {meta ? <p className="meta-info">{meta}</p> : null}
    </article>
  );
}
