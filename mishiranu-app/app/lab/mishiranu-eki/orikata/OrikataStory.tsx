import Image from "next/image";
import Link from "next/link";
import { TUTORIAL_PAGES } from "../tutorial-copy";
import "./orikata.css";

const [verse, intro, beginning, ...rest] = TUTORIAL_PAGES;
const howTo = rest[rest.length - 1]!;
const featurePages = rest.slice(0, -1);

export default function OrikataStory() {
  return (
    <div className="orikata">
      <div className="orikata-shell">
        <header className="orikata-hero">
          {verse!.verseLines?.length ? (
            <div
              className={[
                "orikata-verse",
                verse.verseMotion ? `orikata-verse--${verse.verseMotion}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
              lang="ja"
              aria-label="帰りの縦書き3列"
            >
              {verse.verseLines.map((line, i) => (
                <p
                  key={line}
                  className="orikata-verse-line"
                  style={{ ["--i" as string]: i }}
                >
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          <p className="orikata-brand">見知らぬ駅</p>
          <h1 className="orikata-title">{intro!.title}</h1>
          {intro!.bodies.map((body) => (
            <p key={body.slice(0, 20)} className="orikata-lede">
              {body}
            </p>
          ))}
          <div className="orikata-hero-phone">
            <Image
              src="/story/orikata/map-yodo.png"
              alt="徒歩圏の地図と動線"
              width={780}
              height={1594}
              priority
              sizes="260px"
            />
          </div>
        </header>

        <main>
          <section className="orikata-section">
            {beginning!.kicker ? (
              <p className="orikata-kicker">{beginning.kicker}</p>
            ) : null}
            <h2 className="orikata-h2">{beginning!.title}</h2>
            {beginning!.quote ? (
              <blockquote className="orikata-quote">
                <p>{beginning.quote}</p>
                {beginning.quoteBy ? (
                  <cite>{beginning.quoteBy}</cite>
                ) : null}
              </blockquote>
            ) : null}
            {beginning!.bodies.map((body) => (
              <p key={body.slice(0, 24)} className="orikata-prose">
                {body}
              </p>
            ))}
          </section>

          {featurePages.map((page) => (
            <section className="orikata-section" key={page.title}>
              {page.kicker ? (
                <p className="orikata-kicker">{page.kicker}</p>
              ) : null}
              <h2 className="orikata-h2">{page.title}</h2>
              {page.bodies.map((body) => (
                <p key={body.slice(0, 24)} className="orikata-prose">
                  {body}
                </p>
              ))}
              {page.imageSrc ? (
                <figure className="orikata-shot orikata-shot--solo">
                  <div className="orikata-phone">
                    <Image
                      src={page.imageSrc}
                      alt={page.imageAlt ?? ""}
                      width={780}
                      height={1594}
                      sizes="230px"
                    />
                  </div>
                </figure>
              ) : null}
            </section>
          ))}

          <section className="orikata-section orikata-closing">
            {howTo.kicker ? (
              <p className="orikata-kicker">{howTo.kicker}</p>
            ) : null}
            <h2 className="orikata-h2">
              <Image
                className="orikata-icon"
                src="/story/orikata/app-icon.png"
                alt=""
                width={80}
                height={80}
              />
              {howTo.title}
            </h2>
            {howTo.bodies.map((body) => (
              <p key={body.slice(0, 24)} className="orikata-prose">
                {body}
              </p>
            ))}
            {howTo.steps?.length ? (
              <ol className="orikata-steps">
                {howTo.steps.map((step, i) => (
                  <li key={step.title}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
            <Link className="orikata-cta" href="/lab/mishiranu-eki">
              アプリを開く
              <small>見知らぬ駅</small>
            </Link>
          </section>

          <p className="orikata-foot">Lagado · 見知らぬ駅</p>
        </main>
      </div>
    </div>
  );
}
