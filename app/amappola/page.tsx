import SiteShell from "@/components/SiteShell";
import VerticalCard from "@/components/VerticalCard";

export default function AmappolaPage() {
  return (
    <SiteShell tagline="街に落ちていた、名前のない言葉。">
      <VerticalCard
        text={
          "アマポーラ詩集は、街や日常に落ちていた言葉や風景を、余計な説明をせず、そのまま残した詩集です。意味を届けるのではなく、そこにあったものを見るための本です。"
        }
        meta="アマポーラ詩集 / 淡嶋健仁"
      />
    </SiteShell>
  );
}
