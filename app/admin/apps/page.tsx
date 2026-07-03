import AdminShell from "@/components/AdminShell";
import AppVideoUploadForm from "@/components/AppVideoUploadForm";
import { appVideoDiskBasename, OMIKUJI_APP_VIDEO_BASE } from "@/lib/app-media";

export default function AdminAppsPage() {
  const currentVideo = appVideoDiskBasename(OMIKUJI_APP_VIDEO_BASE);

  return (
    <AdminShell
      title="アプリ動画"
      tagline="おみくじ文庫のデモ動画を、アプリページに載せます。"
    >
      <article className="content-card content-card--flat admin-form-card">
        <p className="admin-section-note">
          {currentVideo
            ? `登録済み: ${currentVideo}`
            : "動画ファイルがまだありません。下からアップロードしてください。"}
        </p>
        <AppVideoUploadForm />
      </article>
    </AdminShell>
  );
}
