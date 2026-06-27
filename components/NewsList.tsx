import Link from "next/link";
import {
  formatNewsDate,
  sortNewsItems,
  type NewsItem,
} from "@/lib/news-types";

type NewsListProps = {
  items: NewsItem[];
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export default function NewsList({ items }: NewsListProps) {
  const sorted = sortNewsItems(items);

  if (sorted.length === 0) {
    return (
      <div className="news-block horizontal-body">
        <p className="news-empty">ただいまお知らせはありません。</p>
      </div>
    );
  }

  return (
    <div className="news-block horizontal-body">
      <ul className="news-list">
        {sorted.map((item) => (
          <li key={item.id} className="news-item">
            <time className="news-date" dateTime={item.createdAt}>
              {formatNewsDate(item.createdAt)}
            </time>
            <h2 className="news-title">{item.title}</h2>
            <p className="news-body">{item.body}</p>
            {item.href ? (
              isExternalHref(item.href) ? (
                <a
                  href={item.href}
                  className="action-btn news-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  詳しく見る
                </a>
              ) : (
                <Link href={item.href} className="action-btn news-link">
                  詳しく見る
                </Link>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
