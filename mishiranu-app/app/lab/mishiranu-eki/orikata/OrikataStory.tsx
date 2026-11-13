import Image from "next/image";
import Link from "next/link";
import "./orikata.css";

const shots = [
  {
    src: "/story/orikata/arrive-yodo.png",
    alt: "見知らぬ駅の到着確認。ここは淀駅です",
    title: "知らない駅に降りる",
    body: "開くと、いまいる駅を確かめます。通り過ぎてきただけの名前が、足元の土地になります。そこから散策がはじまります。",
  },
  {
    src: "/story/orikata/land-fujinomori.png",
    alt: "見知らぬ駅の土地ページ。藤森駅の土地案内と読み上げ",
    title: "歴史と今を、ガイダンスで聴く",
    body: "土地の成り立ちと、いまの空気を書いています。読み上げで聴きながら歩けるので、電車の中でも、改札を出てからも、耳で土地をたどれます。",
  },
  {
    src: "/story/orikata/map-yodo.png",
    alt: "見知らぬ駅の地図ページ。淀駅周辺の徒歩圏と番号付きの動線",
    title: "小回り、大回りして散策する",
    body: "駅を出て、少し回り道をして、同じ駅へ戻る。短い輪か、もう少し先までの輪か。どこにいても駅まで歩いて帰れるようにしています。",
  },
] as const;

export default function OrikataStory() {
  return (
    <div className="orikata">
      <div className="orikata-shell">
        <header className="orikata-hero">
          <p className="orikata-brand">見知らぬ駅</p>
          <h1 className="orikata-title">知らない駅に降りる</h1>
          <p className="orikata-lede">
            土地の歴史と今をガイダンスで聴きながら、小回り、大回りして散策する。
          </p>
          <p className="orikata-lede orikata-lede--soft">
            空っぽの名前だった駅を、用事のない散歩の大事な空間へ変えるアプリです。
          </p>
          <div className="orikata-hero-phone">
            <Image
              src="/story/orikata/map-yodo.png"
              alt="見知らぬ駅の地図。小回り・大回りで駅へ帰る輪"
              width={780}
              height={1688}
              priority
              sizes="260px"
            />
          </div>
        </header>

        <main>
          <section className="orikata-section">
            <p className="orikata-kicker">はじまり</p>
            <h2 className="orikata-h2">存在しないもののように扱われてきた駅</h2>
            <p className="orikata-prose">
              電車の窓に、知らない駅名が何度も流れます。気になっても、ほとんどの人は降りません。調べても有名地かチェーン店ばかりで、その駅そのものの姿は、どこにも書かれていないことが多いからです。
            </p>
            <p className="orikata-prose">
              だから知らない駅は、地図上の点でありながら、中身のない空虚な存在——まるで存在しないもの——になっていました。降りる理由も、聴く案内も、帰れる輪も、手元にないまま通り過ぎるだけです。
            </p>
          </section>

          <section className="orikata-section">
            <p className="orikata-kicker">このアプリの位置</p>
            <h2 className="orikata-h2">降りて、聴いて、回って帰る</h2>
            <p className="orikata-prose">
              見知らぬ駅は、観光地ランキングのアプリではありません。
              <strong>
                知らない駅に降り、土地の歴史と今をガイダンスで聴きながら、小回り・大回りして散策する
              </strong>
              ——そのための装置です。
            </p>
            <div className="orikata-split">
              <article className="orikata-panel">
                <h3>これまでの知らない駅</h3>
                <p>
                  名前だけの点。何もない想像。降りたら立ち尽くす不安。歩く理由も、帰る輪も置かれていない。
                </p>
              </article>
              <article className="orikata-panel orikata-panel--lit">
                <h3>見知らぬ駅にしたあと</h3>
                <p>
                  歴史と今が耳に残る。小回りか大回りかで散策できる。何もないこと自体が、散歩のいちばん良い形になる。
                </p>
              </article>
            </div>
            <p className="orikata-prose" style={{ marginTop: "1.15rem" }}>
              日本中の名所を並べるつもりはありません。
              <strong>いま降りた駅から歩いて、またその駅へ帰る</strong>
              ——その輪だけを、文章と地図と読み上げにしています。
            </p>
          </section>

          <section className="orikata-section">
            <p className="orikata-kicker">なかみ</p>
            <h2 className="orikata-h2">名所がなくても、一周できる</h2>
            <p className="orikata-prose">
              店が少ない駅ほど、川の向きや坂の傾き、橋や田畑の道が主役になります。行き先を探すのではなく、ガイダンスを聴きながら目を置く場所をひとつ持って、駅へ帰る。それが、このアプリの歩き方です。
            </p>
            <div className="orikata-gallery">
              {shots.map((shot) => (
                <figure className="orikata-shot" key={shot.src}>
                  <div className="orikata-phone">
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      width={780}
                      height={1688}
                      sizes="230px"
                    />
                  </div>
                  <figcaption className="orikata-shot__copy">
                    <h3>{shot.title}</h3>
                    <p>{shot.body}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="orikata-section">
            <p className="orikata-kicker">使い方</p>
            <h2 className="orikata-h2">駅を出て、駅へ帰る</h2>
            <ol className="orikata-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>知らない駅に降りる</strong>
                  <p>現在地から探すか、気になっていた駅名を入れます。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>歴史と今を聴く</strong>
                  <p>
                    土地の案内を、読み上げのガイダンスで聴きます。電車の中でも、歩きながらでも。
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>小回りか、大回りか</strong>
                  <p>
                    短い輪か、もう少し先までの輪か。地図で順番を確かめてから出ます。
                  </p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <strong>散策して、駅へ帰る</strong>
                  <p>
                    少し回り道をして、同じ道はなるべく通らず、同じ駅へ戻ります。どこにいても、駅までは歩いて帰れます。
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section className="orikata-section orikata-closing">
            <p className="orikata-kicker">おわりに</p>
            <h2 className="orikata-h2">
              <Image
                className="orikata-icon"
                src="/story/orikata/app-icon.png"
                alt=""
                width={80}
                height={80}
              />
              空っぽの名前を、歩く土地へ
            </h2>
            <p className="orikata-prose">
              知らない駅は、もともと無意味だったわけではありません。手元に、聴く案内と、小回り・大回りの輪がなかっただけです。
            </p>
            <p className="orikata-prose">
              用事のない散歩のいちばん良い形は、しばしば「何もない」ところにあります。その空白を、大事な空間として扱えるように——そう思って、少しずつ駅を増やしています。
            </p>
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
