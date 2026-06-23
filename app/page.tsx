import SiteShell from "@/components/SiteShell";
import VerticalCard from "@/components/VerticalCard";

export default function HomePage() {
  return (
    <SiteShell>
      <VerticalCard
        text={
          "ラガード研究所は、古道具と漂着物、言葉の標本を集める小さな工房です。説明より先に、そこにあるものを見る。名前がはがれたものも、意味の前の響きも、そのまま並べます。"
        }
        meta="ラガード研究所 / 淡嶋健仁"
      />
    </SiteShell>
  );
}
