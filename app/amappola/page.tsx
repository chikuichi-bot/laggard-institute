import SiteShell from "@/components/SiteShell";
import VerticalCard from "@/components/VerticalCard";

export default function AmappolaPage() {
  return (
    <SiteShell tagline="言葉になる前の地平線を見る、詩集。">
      <VerticalCard
        text={
          "アマポーラ詩集は、意味を届けるのではなく、存在として残す詩集です。語り手の内面ではなく、外から見える光景と声だけ。世界に落ちている言葉を採集し、標本にする。おみくじ文庫は、その態度を機械にしたもの。"
        }
        meta="アマポーラ詩集 / 見方の正本"
      />
    </SiteShell>
  );
}
